using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PathFinder;

/// <summary>
/// Pose des tâches planifiées au niveau OS (launchd sur macOS, Task Scheduler
/// sur Windows) pour qu'un scan programmé s'exécute même app fermée.
///
/// Fallback : si le scheduler système n'est pas disponible ou échoue,
/// on se rabat sur ScheduleService (timer in-process, marche seulement
/// tant que l'app tourne).
/// </summary>
public static class SystemScheduler
{
    private static readonly string PathFinderDir =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".pathfinder");

    private static readonly string SchedulesDir = Path.Combine(PathFinderDir, "schedules");
    private static readonly string AuthFile = Path.Combine(PathFinderDir, "auth.json");

    private const string TaskPrefix = "com.pathfinder.scan.";

    public static bool IsSupported =>
        RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ||
        RuntimeInformation.IsOSPlatform(OSPlatform.Windows);

    /// <summary>Chemin absolu vers bg_runner.py, empaqueté dans l'app.</summary>
    public static string? FindBgRunner()
    {
        // Dans l'app packagée, les Scripts sont copiés en tant que MauiAsset.
        // On essaie plusieurs localisations plausibles.
        var candidates = new List<string>
        {
            Path.Combine(AppContext.BaseDirectory, "Scripts", "bg_runner.py"),
            Path.Combine(AppContext.BaseDirectory, "..", "Resources", "Scripts", "bg_runner.py"),
            Path.Combine(AppContext.BaseDirectory, "Resources", "Scripts", "bg_runner.py"),
        };

        // Fallback dev : pendant les tests depuis la source
        var cwd = Directory.GetCurrentDirectory();
        candidates.Add(Path.Combine(cwd, "PathFinderMAUI", "Scripts", "bg_runner.py"));
        candidates.Add(Path.Combine(cwd, "Scripts", "bg_runner.py"));

        foreach (var c in candidates)
        {
            var full = Path.GetFullPath(c);
            if (File.Exists(full)) return full;
        }
        return null;
    }

    private static string FindPython()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            foreach (var p in new[] { "python", "python3", "py" })
            {
                if (TryWhich(p, out var full)) return full;
            }
            return "python";
        }
        foreach (var p in new[]
                 {
                     "/opt/homebrew/bin/python3",
                     "/usr/local/bin/python3",
                     "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3",
                     "/Library/Frameworks/Python.framework/Versions/Current/bin/python3",
                     "/usr/bin/python3",
                 })
        {
            if (File.Exists(p)) return p;
        }
        return "python3";
    }

    private static bool TryWhich(string name, out string full)
    {
        full = name;
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "where" : "which",
                Arguments = name,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return false;
            p.WaitForExit(2000);
            var line = p.StandardOutput.ReadLine();
            if (!string.IsNullOrWhiteSpace(line))
            {
                full = line.Trim();
                return true;
            }
        }
        catch { }
        return false;
    }

    // ------------------------------------------------------------------
    // Persistence : auth + schedule JSON lus par bg_runner.py
    // ------------------------------------------------------------------

    /// <summary>Écrit le couple (api_url, token) utilisable par bg_runner.py.</summary>
    public static void PersistAuth(string apiUrl, string token)
    {
        Directory.CreateDirectory(PathFinderDir);
        var obj = new JsonObject
        {
            ["api_url"] = apiUrl,
            ["token"] = token,
            ["updated_at"] = DateTime.UtcNow.ToString("o"),
        };
        File.WriteAllText(AuthFile, obj.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        try
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                File.SetUnixFileMode(AuthFile, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        catch { }
    }

    /// <summary>Écrit la config d'une planification sur disque pour bg_runner.</summary>
    public static void PersistSchedule(ScheduledScan s)
    {
        Directory.CreateDirectory(SchedulesDir);
        var path = Path.Combine(SchedulesDir, $"{s.Id}.json");
        var obj = s.ToJson();
        File.WriteAllText(path, obj.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }

    public static void DeleteSchedule(string scheduleId)
    {
        var path = Path.Combine(SchedulesDir, $"{scheduleId}.json");
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    // ------------------------------------------------------------------
    // API publique : Install / Uninstall
    // ------------------------------------------------------------------

    public static bool Install(ScheduledScan s, out string message)
    {
        message = "";
        try
        {
            PersistSchedule(s);

            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                return InstallLaunchd(s, out message);
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return InstallWindowsTask(s, out message);

            message = "Scheduler système non supporté sur cette plateforme (fallback in-app).";
            return false;
        }
        catch (Exception ex)
        {
            message = $"Erreur install : {ex.Message}";
            return false;
        }
    }

    public static bool Uninstall(string scheduleId, out string message)
    {
        message = "";
        try
        {
            DeleteSchedule(scheduleId);
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                return UninstallLaunchd(scheduleId, out message);
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return UninstallWindowsTask(scheduleId, out message);
            message = "Plateforme non supportée.";
            return true;
        }
        catch (Exception ex)
        {
            message = $"Erreur uninstall : {ex.Message}";
            return false;
        }
    }

    // ------------------------------------------------------------------
    // macOS : launchd (user agent, ~/Library/LaunchAgents)
    // ------------------------------------------------------------------

    private static string LaunchAgentsDir =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                     "Library", "LaunchAgents");

    private static string LaunchdLabel(string scheduleId) => TaskPrefix + scheduleId;

    private static string LaunchdPlistPath(string scheduleId) =>
        Path.Combine(LaunchAgentsDir, LaunchdLabel(scheduleId) + ".plist");

    private static bool InstallLaunchd(ScheduledScan s, out string message)
    {
        var runner = FindBgRunner();
        if (runner == null)
        {
            message = "bg_runner.py introuvable dans l'app.";
            return false;
        }
        Directory.CreateDirectory(LaunchAgentsDir);

        var label = LaunchdLabel(s.Id);
        var python = FindPython();
        var stdout = Path.Combine(PathFinderDir, "logs", $"{label}.out.log");
        var stderr = Path.Combine(PathFinderDir, "logs", $"{label}.err.log");
        Directory.CreateDirectory(Path.GetDirectoryName(stdout)!);

        var schedule = BuildLaunchdSchedule(s);

        var plist =
$@"<?xml version=""1.0"" encoding=""UTF-8""?>
<!DOCTYPE plist PUBLIC ""-//Apple//DTD PLIST 1.0//EN""
  ""http://www.apple.com/DTDs/PropertyList-1.0.dtd"">
<plist version=""1.0"">
<dict>
  <key>Label</key><string>{Escape(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{Escape(python)}</string>
    <string>{Escape(runner)}</string>
    <string>--schedule-id</string>
    <string>{Escape(s.Id)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>{Escape(stdout)}</string>
  <key>StandardErrorPath</key><string>{Escape(stderr)}</string>
  {schedule}
</dict>
</plist>
";

        var plistPath = LaunchdPlistPath(s.Id);
        File.WriteAllText(plistPath, plist);

        // Recharger : bootout puis bootstrap
        var uid = GetMacUserId();
        TryLaunchctl($"bootout gui/{uid} {plistPath}"); // ignore si pas déjà chargé
        var ok = TryLaunchctl($"bootstrap gui/{uid} {plistPath}", out var err);
        if (!ok)
        {
            // Compat macOS < 11 : fallback sur l'ancienne syntaxe
            TryLaunchctl($"unload {plistPath}");
            ok = TryLaunchctl($"load {plistPath}", out err);
        }
        message = ok ? $"LaunchAgent installé : {plistPath}"
                     : $"launchctl a échoué : {err}";
        return ok;
    }

    private static bool UninstallLaunchd(string scheduleId, out string message)
    {
        var plistPath = LaunchdPlistPath(scheduleId);
        var uid = GetMacUserId();
        TryLaunchctl($"bootout gui/{uid} {plistPath}");
        TryLaunchctl($"unload {plistPath}");
        try { if (File.Exists(plistPath)) File.Delete(plistPath); } catch { }
        message = $"LaunchAgent supprimé : {plistPath}";
        return true;
    }

    private static string BuildLaunchdSchedule(ScheduledScan s)
    {
        // Launchd supporte StartCalendarInterval (horaires) et StartInterval (secondes).
        switch (s.Frequency)
        {
            case ScheduleFrequency.Hourly:
                return "<key>StartInterval</key><integer>3600</integer>";
            case ScheduleFrequency.Weekly:
                return $@"<key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>{s.DayOfWeek % 7}</integer>
    <key>Hour</key><integer>{s.TimeOfDay.Hours}</integer>
    <key>Minute</key><integer>{s.TimeOfDay.Minutes}</integer>
  </dict>";
            case ScheduleFrequency.Daily:
            default:
                return $@"<key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>{s.TimeOfDay.Hours}</integer>
    <key>Minute</key><integer>{s.TimeOfDay.Minutes}</integer>
  </dict>";
        }
    }

    private static string GetMacUserId()
    {
        try
        {
            var psi = new ProcessStartInfo("id", "-u")
            {
                RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p != null)
            {
                p.WaitForExit(2000);
                var line = p.StandardOutput.ReadLine();
                if (!string.IsNullOrWhiteSpace(line)) return line.Trim();
            }
        }
        catch { }
        return "501";
    }

    private static bool TryLaunchctl(string args) => TryLaunchctl(args, out _);

    private static bool TryLaunchctl(string args, out string err)
    {
        err = "";
        try
        {
            var psi = new ProcessStartInfo("/bin/launchctl", args)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return false;
            p.WaitForExit(5000);
            err = p.StandardError.ReadToEnd();
            return p.ExitCode == 0;
        }
        catch (Exception ex)
        {
            err = ex.Message;
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Windows : schtasks
    // ------------------------------------------------------------------

    private static string WindowsTaskName(string scheduleId) =>
        "PathFinder\\" + TaskPrefix + scheduleId;

    private static bool InstallWindowsTask(ScheduledScan s, out string message)
    {
        var runner = FindBgRunner();
        if (runner == null)
        {
            message = "bg_runner.py introuvable dans l'app.";
            return false;
        }

        var name = WindowsTaskName(s.Id);
        var python = FindPython();
        var action = $"\"{python}\" \"{runner}\" --schedule-id {s.Id}";

        string scheduleArgs = s.Frequency switch
        {
            ScheduleFrequency.Hourly =>
                "/SC HOURLY /MO 1",
            ScheduleFrequency.Weekly =>
                $"/SC WEEKLY /D {WindowsDow(s.DayOfWeek)} /ST {s.TimeOfDay:hh\\:mm}",
            _ =>
                $"/SC DAILY /ST {s.TimeOfDay:hh\\:mm}",
        };

        // Création en mode "remplacer si existant"
        var args = $"/Create /F /TN \"{name}\" /TR \"{action}\" {scheduleArgs}";
        var ok = RunSchtasks(args, out var output);
        message = ok ? "Tâche Windows créée" : $"schtasks a échoué : {output}";
        return ok;
    }

    private static bool UninstallWindowsTask(string scheduleId, out string message)
    {
        var name = WindowsTaskName(scheduleId);
        var args = $"/Delete /F /TN \"{name}\"";
        var ok = RunSchtasks(args, out var output);
        message = ok ? "Tâche Windows supprimée" : $"schtasks : {output}";
        return ok;
    }

    private static string WindowsDow(int day) => (day % 7) switch
    {
        0 => "SUN", 1 => "MON", 2 => "TUE", 3 => "WED",
        4 => "THU", 5 => "FRI", 6 => "SAT",
        _ => "MON",
    };

    private static bool RunSchtasks(string args, out string output)
    {
        output = "";
        try
        {
            var psi = new ProcessStartInfo("schtasks.exe", args)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return false;
            p.WaitForExit(10000);
            output = (p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd()).Trim();
            return p.ExitCode == 0;
        }
        catch (Exception ex)
        {
            output = ex.Message;
            return false;
        }
    }

    private static string Escape(string s) =>
        (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;")
                 .Replace(">", "&gt;");
}
