using System.Diagnostics;
using System.Text.Json.Nodes;

namespace PathFinder;

public static class ScheduleService
{
	private const string PREF_KEY = "scheduled_scans_v1";
	private static readonly object _lock = new();
	private static Timer? _timer;
	private static bool _running;

	public static Action<ScheduledScan>? OnScanDue;

	public static List<ScheduledScan> Load()
	{
		lock (_lock)
		{
			var raw = Preferences.Get(PREF_KEY, "");
			if (string.IsNullOrWhiteSpace(raw)) return new List<ScheduledScan>();
			try
			{
				var arr = JsonNode.Parse(raw) as JsonArray;
				if (arr == null) return new List<ScheduledScan>();
				return arr.Select(n => ScheduledScan.FromJson(n!)).ToList();
			}
			catch (Exception ex)
			{
				Debug.WriteLine($"ScheduleService.Load error: {ex.Message}");
				return new List<ScheduledScan>();
			}
		}
	}

	public static void Save(List<ScheduledScan> schedules)
	{
		lock (_lock)
		{
			var arr = new JsonArray();
			foreach (var s in schedules) arr.Add(s.ToJson());
			Preferences.Set(PREF_KEY, arr.ToJsonString());
		}
	}

	public static void Upsert(ScheduledScan schedule)
	{
		var list = Load();
		var idx = list.FindIndex(x => x.Id == schedule.Id);
		if (idx >= 0) list[idx] = schedule;
		else list.Add(schedule);
		Save(list);
	}

	public static void Delete(string id)
	{
		var list = Load();
		list.RemoveAll(x => x.Id == id);
		Save(list);
	}

	public static void Start()
	{
		lock (_lock)
		{
			if (_timer != null) return;
			_timer = new Timer(_ => Tick(), null, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(30));
			Debug.WriteLine("🕒 ScheduleService: timer started");
		}
	}

	private static void Tick()
	{
		if (_running) return;
		_running = true;
		try
		{
			var schedules = Load();
			var now = DateTime.Now;
			bool changed = false;

			foreach (var s in schedules)
			{
				if (!s.Enabled) continue;
				if (s.NextRunAt > now) continue;

				Debug.WriteLine($"🕒 ScheduleService: triggering {s.Targets} ({s.Mode})");
				s.LastRunAt = now;
				s.NextRunAt = s.ComputeNextRun(now);
				changed = true;

				try
				{
					var handler = OnScanDue;
					if (handler != null)
						MainThread.BeginInvokeOnMainThread(() => handler(s));
				}
				catch (Exception ex)
				{
					Debug.WriteLine($"ScheduleService dispatch error: {ex.Message}");
				}
			}

			if (changed) Save(schedules);
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"ScheduleService.Tick error: {ex.Message}");
		}
		finally
		{
			_running = false;
		}
	}
}
