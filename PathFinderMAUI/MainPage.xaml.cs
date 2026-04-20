using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PathFinder;

public partial class MainPage : ContentPage
{
	private string lastScanResults = "";
	private string lastNetworkRange = "";
	private JsonArray? lastScanData = null;
	private const string API_URL = "http://localhost:5001/api";
	private readonly HttpClient httpClient;
	private bool _scanInProgress = false;

	// Liste de ports par mode
	private static readonly string FAST_PORTS = "21,22,23,25,53,80,110,139,143,443,445,3389,8080";
	private static readonly string FULL_PORTS = "20,21,22,23,25,53,80,110,111,135,139,143,443,445,465,587,993,995,1433,1521,3306,3389,5000,5001,5432,5900,5985,5986,6379,8000,8080,8443,8888,9090,9200,27017,27018,50000";
	
	public MainPage()
	{
		try
	{
		InitializeComponent();
			httpClient = new HttpClient();
			
			Debug.WriteLine("✅ MainPage: Initialisation démarrée");
			
			// Vérifier l'authentification
			var token = Preferences.Get("auth_token", "");
			if (string.IsNullOrEmpty(token))
			{
				Debug.WriteLine("⚠️ MainPage: Pas de token, redirection vers login");
				// Rediriger vers login si pas connecté
				Application.Current.MainPage = new NavigationPage(new LoginPage());
				return;
			}
			
			// Afficher l'utilisateur connecté
			var username = Preferences.Get("user_username", "Utilisateur");
			var email = Preferences.Get("user_email", "");
			UserLabel.Text = $"👤 {username} ({email})";
			
			Debug.WriteLine($"✅ MainPage: Utilisateur {username} connecté");
			
			// Configurer le header d'authentification
			httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
			
			Debug.WriteLine("✅ MainPage: Headers configurés");
			
			// Enregistrer cette instance comme gestionnaire des scans programmés (remplace toute instance précédente)
			ScheduleService.OnScanDue = OnScheduleDue;
			ScheduleService.Start();

			// Lancer la détection et le scan automatiquement au démarrage
			_ = InitializeAndAutoScan();
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"❌ ERREUR CRITIQUE MainPage Constructor: {ex.Message}");
			Debug.WriteLine($"   Stack: {ex.StackTrace}");
			
			// Afficher l'erreur à l'utilisateur
			Device.BeginInvokeOnMainThread(async () =>
			{
				await DisplayAlert("Erreur Critique", 
					$"L'application a rencontré une erreur au démarrage:\n\n{ex.Message}\n\nVeuillez redémarrer l'application.", 
					"OK");
			});
		}
	}
	
	private async void OnLogoutClicked(object sender, EventArgs e)
	{
		bool confirm = await DisplayAlert(
			"Déconnexion", 
			"Voulez-vous vraiment vous déconnecter ?", 
			"Oui", 
			"Non"
		);
		
		if (confirm)
		{
			// Supprimer toutes les données de session
			Preferences.Remove("auth_token");
			Preferences.Remove("user_email");
			Preferences.Remove("user_username");
			Preferences.Remove("user_id");
			
			// Afficher un message de confirmation
			await DisplayAlert("✅ Déconnexion", "Vous avez été déconnecté avec succès", "OK");
			
			// Rediriger vers la page de login
			Application.Current.MainPage = new NavigationPage(new LoginPage());
		}
	}

	private async Task InitializeAndAutoScan()
	{
		try
		{
			StatusLabel.Text = "🔄 Détection automatique du réseau...";
			LocalIPLabel.Text = "🔍 Analyse de votre IP locale...";
			
			// Détecter l'IP locale
			var localIp = GetLocalIPAddress();
			
			if (!string.IsNullOrEmpty(localIp))
			{
				LocalIPLabel.Text = $"Votre IP : {localIp}";
				var networkRange = GetNetworkRange(localIp);
				TargetEditor.Text = networkRange;
				StatusLabel.Text = $"✅ Réseau {networkRange} détecté — prêt à scanner";
			}
			else
			{
				LocalIPLabel.Text = "⚠️ Détection automatique échouée";
				StatusLabel.Text = "⚠️ Saisissez manuellement la plage réseau à scanner";
				TargetEditor.Text = "192.168.1.0/24";
			}
		}
		catch (Exception ex)
		{
			LocalIPLabel.Text = "❌ Erreur de détection";
			StatusLabel.Text = $"❌ Erreur d'initialisation : {ex.Message}";
			TargetEditor.Text = "192.168.1.0/24";
		}
	}

	private string GetLocalIPAddress()
	{
		try
		{
			// Méthode 1: Utiliser NetworkInterface pour obtenir l'IP active
			foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
			{
				// Ignorer les interfaces non opérationnelles, loopback, ou virtuelles
				if (ni.OperationalStatus != OperationalStatus.Up)
					continue;
				
				if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback)
					continue;
				
				// Vérifier si c'est une interface virtuelle (VPN, VM, etc.)
				var name = ni.Name.ToLower();
				if (name.Contains("virtual") || name.Contains("vmware") || 
				    name.Contains("virtualbox") || name.Contains("vbox") ||
				    name.Contains("hyper-v") || name.Contains("docker") ||
				    name.Contains("vpn") || name.Contains("utun"))
					continue;

				var props = ni.GetIPProperties();
				
				// Chercher une adresse IPv4 privée
				foreach (var ip in props.UnicastAddresses)
				{
					if (ip.Address.AddressFamily == AddressFamily.InterNetwork)
					{
						var ipStr = ip.Address.ToString();
						
						// Vérifier si c'est une IP privée
						if (IsPrivateIP(ipStr))
						{
							return ipStr;
						}
					}
				}
			}
			
			// Méthode 2: Fallback - Connexion UDP pour déterminer l'IP sortante
			using (Socket socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
			{
				socket.Connect("8.8.8.8", 65530);
				IPEndPoint? endPoint = socket.LocalEndPoint as IPEndPoint;
				if (endPoint != null && IsPrivateIP(endPoint.Address.ToString()))
				{
					return endPoint.Address.ToString();
				}
			}
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"Erreur lors de la détection de l'IP locale : {ex.Message}");
		}
		
		return "";
	}

	private bool IsPrivateIP(string ipAddress)
	{
		// Vérifier si l'IP est dans une plage privée
		var parts = ipAddress.Split('.');
		if (parts.Length != 4) return false;
		
		if (!int.TryParse(parts[0], out int first)) return false;
		if (!int.TryParse(parts[1], out int second)) return false;
		
		// 10.0.0.0 - 10.255.255.255
		if (first == 10) return true;
		
		// 172.16.0.0 - 172.31.255.255
		if (first == 172 && second >= 16 && second <= 31) return true;
		
		// 192.168.0.0 - 192.168.255.255
		if (first == 192 && second == 168) return true;
		
		return false;
	}

	private string GetNetworkRange(string ipAddress)
	{
		try
		{
			var parts = ipAddress.Split('.');
			if (parts.Length == 4)
			{
				// Pour les réseaux privés, on utilise généralement /24 (masque 255.255.255.0)
				// Calculer l'adresse réseau en mettant le dernier octet à 0
				return $"{parts[0]}.{parts[1]}.{parts[2]}.0/24";
			}
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"Erreur lors du calcul du réseau : {ex.Message}");
		}
		
		return "192.168.1.0/24";
	}

	private async void OnScanClicked(object sender, EventArgs e)
	{
		var mode = ModeFullRadio.IsChecked ? ScanMode.Full : ScanMode.Fast;
		var rawTargets = TargetEditor.Text ?? "";
		await PerformScan(rawTargets, mode);
	}

	private async void OnScheduleClicked(object sender, EventArgs e)
	{
		await Navigation.PushAsync(new ScheduledScansPage());
	}

	private async void OnScheduleDue(ScheduledScan schedule)
	{
		if (_scanInProgress)
		{
			Debug.WriteLine($"🕒 Scheduler: scan en cours, report de {schedule.Id}");
			return;
		}
		Debug.WriteLine($"🕒 Scheduler: lancement scan programmé ({schedule.Targets})");
		await PerformScan(schedule.Targets, schedule.Mode, isScheduled: true);
	}

	private List<string> ParseAndValidateTargets(string raw, out List<string> invalid)
	{
		invalid = new List<string>();
		var valid = new List<string>();
		if (string.IsNullOrWhiteSpace(raw)) return valid;

		var entries = raw.Split(new[] { '\n', '\r', ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
			.Select(s => s.Trim())
			.Where(s => s.Length > 0)
			.Distinct()
			.ToList();

		foreach (var entry in entries)
		{
			if (IsValidTarget(entry)) valid.Add(entry);
			else invalid.Add(entry);
		}
		return valid;
	}

	private static bool IsValidTarget(string entry)
	{
		if (string.IsNullOrWhiteSpace(entry)) return false;

		// CIDR : a.b.c.d/NN
		var slash = entry.IndexOf('/');
		if (slash > 0)
		{
			var ipPart = entry.Substring(0, slash);
			var maskPart = entry.Substring(slash + 1);
			if (!IPAddress.TryParse(ipPart, out _)) return false;
			if (!int.TryParse(maskPart, out var mask)) return false;
			return mask >= 0 && mask <= 32;
		}

		// IP ou hostname : on accepte si parse IP OK, ou si format hostname plausible
		if (IPAddress.TryParse(entry, out _)) return true;
		if (System.Text.RegularExpressions.Regex.IsMatch(entry, @"^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$") && entry.Length <= 253)
			return true;
		return false;
	}

	private async Task PerformScan(string rawTargets, ScanMode mode, bool isScheduled = false)
	{
		if (_scanInProgress)
		{
			if (!isScheduled)
				await DisplayAlert("Scan en cours", "Un scan est déjà en cours. Veuillez patienter.", "OK");
			return;
		}

		var targets = ParseAndValidateTargets(rawTargets, out var invalid);

		if (invalid.Count > 0)
		{
			InvalidTargetsPanel.IsVisible = true;
			InvalidTargetsLabel.Text = string.Join(", ", invalid);
		}
		else
		{
			InvalidTargetsPanel.IsVisible = false;
		}

		if (targets.Count == 0)
		{
			StatusLabel.Text = "⚠️ Aucune cible valide à scanner";
			if (!isScheduled)
				await DisplayAlert("Cibles invalides", "Aucune cible valide trouvée. Vérifiez le format (IP, CIDR ou hostname).", "OK");
			return;
		}

		_scanInProgress = true;
		ScanButton.IsEnabled = false;
		ScanButton.Text = "⏳ SCAN EN COURS";
		ExportButton.IsEnabled = false;

		ProgressPanel.IsVisible = true;
		ProgressBarUI.Progress = 0;
		ProgressStatusIcon.Text = "⏳";
		ProgressTitleLabel.Text = isScheduled ? "Scan programmé en cours…" : "Scan en cours…";
		ProgressDetailsLabel.Text = $"Préparation de {targets.Count} cible(s) — mode {(mode == ScanMode.Full ? "Complet" : "Rapide")}";
		ProgressElapsedLabel.Text = "⏱ 0s";

		var sw = Stopwatch.StartNew();
		using var elapsedTimer = new System.Threading.Timer(_ =>
		{
			MainThread.BeginInvokeOnMainThread(() =>
			{
				if (ProgressPanel.IsVisible)
					ProgressElapsedLabel.Text = $"⏱ {FormatElapsed(sw.Elapsed)}";
			});
		}, null, 1000, 1000);

		var combinedResultsText = new StringBuilder();
		int successCount = 0;
		int failCount = 0;

		try
		{
			for (int i = 0; i < targets.Count; i++)
			{
				var target = targets[i];
				ProgressTitleLabel.Text = $"🎯 Scan {i + 1}/{targets.Count} — {target}";
				ProgressDetailsLabel.Text = $"Mode {(mode == ScanMode.Full ? "Complet" : "Rapide")} • {successCount} succès • {failCount} échec(s)";
				ProgressBarUI.Progress = (double)i / targets.Count;
				ResultsLabel.Text = combinedResultsText.Length == 0
					? $"⏳ Scan en cours sur {target}…"
					: combinedResultsText.ToString() + $"\n\n⏳ Scan en cours sur {target}…";

				try
				{
					var text = await RunNetworkScan(target, mode);
					var targetData = lastScanData;

					combinedResultsText.AppendLine($"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
					combinedResultsText.AppendLine($"🎯 CIBLE : {target}  ({(mode == ScanMode.Full ? "Complet" : "Rapide")})");
					combinedResultsText.AppendLine($"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
					combinedResultsText.AppendLine(text);
					combinedResultsText.AppendLine();

					if (targetData != null)
					{
						try
						{
							await SendScanToAPI(targetData, target, mode);
						}
						catch (Exception apiEx)
						{
							Debug.WriteLine($"⚠️ API send error for {target}: {apiEx.Message}");
							combinedResultsText.AppendLine($"⚠️ Envoi API échoué pour {target} : {apiEx.Message}");
						}
					}

					successCount++;
				}
				catch (Exception ex)
				{
					failCount++;
					combinedResultsText.AppendLine($"❌ Erreur sur {target} : {ex.Message}\n");
				}

				ResultsLabel.Text = combinedResultsText.ToString();
			}

			sw.Stop();
			ProgressBarUI.Progress = 1;
			ProgressStatusIcon.Text = failCount == 0 ? "✅" : (successCount > 0 ? "⚠️" : "❌");
			ProgressTitleLabel.Text = failCount == 0 ? "Scan terminé" : (successCount > 0 ? "Scan terminé avec avertissements" : "Scan échoué");
			ProgressDetailsLabel.Text = $"{successCount} succès • {failCount} échec(s) sur {targets.Count} cible(s)";
			ProgressElapsedLabel.Text = $"⏱ Durée totale : {FormatElapsed(sw.Elapsed)}";

			StatusLabel.Text = $"✅ {successCount}/{targets.Count} scan(s) terminé(s) en {FormatElapsed(sw.Elapsed)}";

			lastScanResults = combinedResultsText.ToString();
			lastNetworkRange = targets.Count == 1 ? targets[0] : $"{targets.Count} cibles";
			if (successCount > 0) ExportButton.IsEnabled = true;
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"❌ PerformScan fatal: {ex.Message}");
			StatusLabel.Text = "❌ Échec de l'analyse";
			ProgressStatusIcon.Text = "❌";
			ProgressTitleLabel.Text = "Scan interrompu";
			ProgressDetailsLabel.Text = ex.Message;
			if (!isScheduled)
				await DisplayAlert("Erreur de Scan", ex.Message, "OK");
		}
		finally
		{
			_scanInProgress = false;
			ScanButton.IsEnabled = true;
			ScanButton.Text = "🔍 SCANNER";
		}
	}

	private static string FormatElapsed(TimeSpan ts)
	{
		if (ts.TotalSeconds < 60) return $"{(int)ts.TotalSeconds}s";
		if (ts.TotalMinutes < 60) return $"{(int)ts.TotalMinutes}min {ts.Seconds:D2}s";
		return $"{(int)ts.TotalHours}h {ts.Minutes:D2}min";
	}

	private async Task SendScanToAPI(JsonArray? scanResults, string networkRange, ScanMode mode)
	{
		try
		{
			var resultsJson = scanResults?.ToJsonString() ?? "[]";
			var modeStr = mode == ScanMode.Full ? "full" : "fast";
			var escapedRange = networkRange.Replace("\\", "\\\\").Replace("\"", "\\\"");
			var payloadJson = $"{{\"network_range\":\"{escapedRange}\",\"mode\":\"{modeStr}\",\"results\":{resultsJson}}}";

			var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");
			var response = await httpClient.PostAsync($"{API_URL}/scans", content);

			if (!response.IsSuccessStatusCode)
			{
				var error = await response.Content.ReadAsStringAsync();
				throw new Exception($"API Error: {error}");
			}
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"Erreur envoi API: {ex.Message}");
			throw;
		}
	}
	
	private async void OnExportClicked(object sender, EventArgs e)
	{
		if (string.IsNullOrEmpty(lastScanResults))
		{
			await DisplayAlert("❌ Erreur", "Aucun résultat à exporter. Lancez d'abord un scan.", "OK");
			return;
		}
		
		try
		{
			StatusLabel.Text = "📄 Export en cours...";
			ExportButton.IsEnabled = false;
			
			var html = GenerateHtmlReport(lastScanResults, lastNetworkRange);
			
			// Générer le nom de fichier
			var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
			var filename = $"PathFinder_Report_{timestamp}.html";
			
			// Sauvegarder dans le dossier Documents
			var documentsPath = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
			var pathfinderDir = Path.Combine(documentsPath, "PathFinder_Reports");
			Directory.CreateDirectory(pathfinderDir);
			
			var filepath = Path.Combine(pathfinderDir, filename);
			await File.WriteAllTextAsync(filepath, html, Encoding.UTF8);
			
			StatusLabel.Text = $"✅ Rapport exporté avec succès";
			
			var result = await DisplayAlert(
				"✅ Export réussi", 
				$"Le rapport a été enregistré dans:\n{filepath}\n\nOuvrir le rapport ?", 
				"Ouvrir", 
				"Fermer"
			);
			
			if (result)
			{
				// Ouvrir le fichier avec l'application par défaut
				await Launcher.OpenAsync(new OpenFileRequest
				{
					File = new ReadOnlyFile(filepath)
				});
			}
		}
		catch (Exception ex)
		{
			await DisplayAlert("❌ Erreur d'export", ex.Message, "OK");
			StatusLabel.Text = "❌ Échec de l'export";
		}
		finally
		{
			ExportButton.IsEnabled = true;
		}
	}
	
	private string GenerateHtmlReport(string scanResults, string networkRange)
	{
		var timestamp = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss");
		
		// Convertir le texte en HTML avec style
		var htmlContent = System.Security.SecurityElement.Escape(scanResults)
			.Replace("\n", "<br>")
			.Replace(" ", "&nbsp;");
		
		var html = $@"
<!DOCTYPE html>
<html lang=""fr"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>PathFinder - Rapport de Pentest</title>
    <style>
        @media print {{
            body {{ background: white; }}
            .no-print {{ display: none; }}
        }}
        
        body {{
            font-family: 'Courier New', monospace;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            color: #e2e8f0;
            padding: 30px;
            margin: 0;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: #16213e;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
        }}
        
        .header {{
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
            border-radius: 15px;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            margin: 0;
            font-size: 48px;
            color: white;
            text-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }}
        
        .meta-info {{
            background: #1a1a2e;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 4px solid #06b6d4;
        }}
        
        .meta-info p {{
            margin: 8px 0;
            color: #94a3b8;
        }}
        
        .meta-info strong {{
            color: #06b6d4;
        }}
        
        .results {{
            background: #0a0a0f;
            padding: 30px;
            border-radius: 15px;
            font-size: 13px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #64748b;
            border-top: 2px solid #8b5cf6;
        }}
        
        .btn-print {{
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }}
        
        .btn-print:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
        }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>🎯 PathFinder</h1>
            <p style=""margin: 10px 0 0 0; font-size: 18px; color: #e2e8f0;"">Rapport de Pentest Professionnel</p>
        </div>
        
        <button class=""btn-print no-print"" onclick=""window.print()"">🖨️ Imprimer / Sauvegarder en PDF</button>
        
        <div class=""meta-info"">
            <p><strong>📅 Date du scan:</strong> {timestamp}</p>
            <p><strong>🌐 Réseau analysé:</strong> {networkRange}</p>
            <p><strong>🛡️ Scanner:</strong> PathFinder Professional Security Scanner v2.0</p>
            <p><strong>⚡ Modules actifs:</strong> CVE Scanner, Directory Buster, Historique, Analyse de Risques</p>
        </div>
        
        <div class=""results"">
{htmlContent}
        </div>
        
        <div class=""footer"">
            <p>🔒 <strong>PathFinder</strong> - Sécurité Réseau Professionnelle</p>
            <p>Généré automatiquement le {timestamp}</p>
            <p style=""font-size: 11px; margin-top: 15px; color: #475569;"">
                ⚠️ Ce rapport contient des informations sensibles de sécurité.<br>
                À utiliser uniquement sur des systèmes dont vous êtes propriétaire ou avec autorisation explicite.
            </p>
        </div>
    </div>
    
    <script>
        // Auto-focus sur le bouton print au chargement
        window.addEventListener('load', function() {{
            console.log('PathFinder Report loaded successfully');
        }});
    </script>
</body>
</html>";
		
		return html;
	}

	private async Task<string> RunNetworkScan(string target, ScanMode mode)
	{
		try
		{
			// Utiliser le répertoire temporaire système au lieu du cache de l'app
			var tempDir = Path.GetTempPath();
			var scriptPath = Path.Combine(tempDir, "network_scanner_pathfinder.py");
			
			// Copier le script Python vers le répertoire temporaire
			try
			{
				await CopyAssetToTemp("Scripts/network_scanner.py", scriptPath);
			}
			catch (Exception ex)
			{
				return $"❌ Impossible de copier le script: {ex.Message}\n\nRépertoire temporaire: {tempDir}";
			}
			
			// Chercher Python3 dans plusieurs emplacements possibles
			var pythonPaths = new[]
			{
				"/Library/Frameworks/Python.framework/Versions/3.14/bin/python3",
				"/Library/Frameworks/Python.framework/Versions/3.13/bin/python3",
				"/Library/Frameworks/Python.framework/Versions/3.12/bin/python3",
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/usr/bin/python3",
				"python3"  // Fallback au PATH
			};
			
			string? pythonPath = null;
			foreach (var path in pythonPaths)
			{
				if (File.Exists(path))
				{
					pythonPath = path;
					break;
				}
			}
			
			if (pythonPath == null)
			{
				pythonPath = "python3"; // Dernier recours
			}
			
			var ports = mode == ScanMode.Fast ? FAST_PORTS : FULL_PORTS;
			var workers = mode == ScanMode.Fast ? 150 : 100;

			var startInfo = new ProcessStartInfo
			{
				FileName = pythonPath,
				Arguments = $"\"{scriptPath}\" \"{target}\" --workers {workers} --ports \"{ports}\"",
				UseShellExecute = false,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
				CreateNoWindow = true
			};
			
			// Ajouter le PATH pour inclure les emplacements Python
			startInfo.EnvironmentVariables["PATH"] = 
				"/Library/Frameworks/Python.framework/Versions/3.14/bin:" +
				"/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:" + 
				Environment.GetEnvironmentVariable("PATH");

			using var process = new Process { StartInfo = startInfo };
			
			try
			{
				process.Start();
			}
			catch (Exception ex)
			{
				return $"❌ Impossible de démarrer Python: {ex.Message}\n\n" +
				       $"Chemin Python testé: {pythonPath}\n" +
				       $"Script: {scriptPath}\n\n" +
				       $"Assurez-vous que Python 3 est installé.";
			}
			
			// Lire la sortie standard et les erreurs
			var output = await process.StandardOutput.ReadToEndAsync();
			var error = await process.StandardError.ReadToEndAsync();
			
			await process.WaitForExitAsync();

			if (process.ExitCode == 0)
			{
				// Extraire le JSON de la sortie entre les marqueurs
				var jsonStartMarker = "<<<JSON_RESULTS_START>>>";
				var jsonEndMarker = "<<<JSON_RESULTS_END>>>";
				
				var startIndex = output.IndexOf(jsonStartMarker);
				var endIndex = output.IndexOf(jsonEndMarker);
				
				if (startIndex >= 0 && endIndex > startIndex)
				{
					// Extraire uniquement le JSON
					startIndex += jsonStartMarker.Length;
					var jsonContent = output.Substring(startIndex, endIndex - startIndex).Trim();
					
					// Sauvegarder les données brutes pour l'API (AOT-compatible avec JsonArray)
					try
					{
						lastScanData = JsonNode.Parse(jsonContent) as JsonArray;
					}
					catch
					{
						lastScanData = null;
					}
					
					// Parser et afficher les résultats
					var results = ParseScanResults(jsonContent);
					return results;
				}
				else
				{
					return $"❌ Format de sortie invalide.\n\nSortie reçue:\n{output}";
				}
			}
			else
			{
				return $"❌ Erreur du script Python:\n\n{error}";
			}
		}
		catch (Exception ex)
		{
			return $"❌ Erreur lors du scan: {ex.Message}\n\nStack trace: {ex.StackTrace}";
		}
	}

	private string ParseScanResults(string json)
	{
		try
		{
			Debug.WriteLine($"🔍 ParseScanResults: Début parsing ({json.Length} caractères)");
			
			// Utiliser JsonDocument pour AOT compatibility
			using var document = JsonDocument.Parse(json);
			var results = document.RootElement;
			
			Debug.WriteLine($"📊 ParseScanResults: Type = {results.ValueKind}, Count = {(results.ValueKind == JsonValueKind.Array ? results.GetArrayLength() : 0)}");
			
			if (results.ValueKind != JsonValueKind.Array || results.GetArrayLength() == 0)
			{
				return "❌ AUCUN HÔTE DÉTECTÉ\n\n" +
				       "Le scan n'a trouvé aucun appareil actif sur le réseau.\n\n" +
				       "Suggestions :\n" +
				       "• Vérifiez la plage réseau saisie\n" +
				       "• Assurez-vous d'être connecté au réseau\n" +
				       "• Certains appareils peuvent bloquer les pings";
			}

			// Convertir en liste pour tri (AOT-compatible)
			var hostsList = new List<JsonElement>();
			foreach (var item in results.EnumerateArray())
			{
				hostsList.Add(item.Clone());
			}

			// Sort results by priority score (highest first)
			var sortedResults = hostsList.OrderByDescending(r => 
			{
				if (r.TryGetProperty("priority_score", out var scoreElement))
				{
					return scoreElement.GetInt32();
				}
				return 0;
			}).ToList();

			var aliveHosts = sortedResults.Where(r => 
			{
				if (r.TryGetProperty("alive", out var aliveElement))
				{
					return aliveElement.GetBoolean();
				}
				return false;
			}).ToList();

			var deadHosts = sortedResults.Where(r => 
			{
				if (r.TryGetProperty("alive", out var aliveElement))
				{
					return !aliveElement.GetBoolean();
				}
				return true;
			}).ToList();

			// Calculer les statistiques de risque (AOT-compatible)
			var criticalHosts = aliveHosts.Count(h => 
			{
				if (h.TryGetProperty("risk_level", out var risk))
					return risk.GetString() == "CRITIQUE";
				return false;
			});
			var highRiskHosts = aliveHosts.Count(h => 
			{
				if (h.TryGetProperty("risk_level", out var risk))
					return risk.GetString() == "ÉLEVÉ";
				return false;
			});
			var mediumRiskHosts = aliveHosts.Count(h => 
			{
				if (h.TryGetProperty("risk_level", out var risk))
					return risk.GetString() == "MOYEN";
				return false;
			});
			var lowRiskHosts = aliveHosts.Count(h => 
			{
				if (h.TryGetProperty("risk_level", out var risk))
					return risk.GetString() == "FAIBLE";
				return false;
			});
			
			var resultText = $"╔════════════════════════════════════════════════╗\n";
			resultText += $"║      RAPPORT DE PENTEST - PATHFINDER          ║\n";
			resultText += $"╚════════════════════════════════════════════════╝\n\n";
			
			resultText += $"📊 STATISTIQUES GLOBALES\n";
			resultText += $"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
			resultText += $"• Total d'adresses IP analysées : {results.GetArrayLength()}\n";
			resultText += $"• ✅ Hôtes actifs détectés : {aliveHosts.Count}\n";
			resultText += $"• ❌ Hôtes hors ligne : {deadHosts.Count}\n\n";
			
			resultText += $"🎯 ANALYSE DES RISQUES\n";
			resultText += $"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
			resultText += $"• 🔴 Risque CRITIQUE : {criticalHosts} hôte(s)\n";
			resultText += $"• 🟠 Risque ÉLEVÉ : {highRiskHosts} hôte(s)\n";
			resultText += $"• 🟡 Risque MOYEN : {mediumRiskHosts} hôte(s)\n";
			resultText += $"• 🟢 Risque FAIBLE : {lowRiskHosts} hôte(s)\n\n";

			// Show alive hosts with detailed information
			if (aliveHosts.Count > 0)
			{
				resultText += $"╔════════════════════════════════════════════════╗\n";
				resultText += $"║         DÉTAILS DES HÔTES DÉCOUVERTS          ║\n";
				resultText += $"╚════════════════════════════════════════════════╝\n\n";
				
				foreach (var host in aliveHosts)
				{
					// Helper pour extraire valeurs (AOT-compatible) avec gestion des types
					string GetStringValue(JsonElement el, string prop, string defaultVal = "")
					{
						if (!el.TryGetProperty(prop, out var p))
							return defaultVal;
						
						// Gérer les différents types
						return p.ValueKind switch
						{
							JsonValueKind.String => p.GetString() ?? defaultVal,
							JsonValueKind.Number => p.GetInt32().ToString(),
							JsonValueKind.True => "True",
							JsonValueKind.False => "False",
							_ => defaultVal
						};
					}
					
					int GetIntValue(JsonElement el, string prop, int defaultVal = 0)
					{
						if (!el.TryGetProperty(prop, out var p))
							return defaultVal;
						
						// Gérer les différents types
						return p.ValueKind switch
						{
							JsonValueKind.Number => p.GetInt32(),
							JsonValueKind.String => int.TryParse(p.GetString(), out var num) ? num : defaultVal,
							_ => defaultVal
						};
					}
					
					var ip = GetStringValue(host, "ip", "Inconnu");
					var mac = GetStringValue(host, "mac", "N/A");
					var hostname = GetStringValue(host, "hostname", "");
					var priorityScore = GetIntValue(host, "priority_score", 0).ToString();
					var riskLevel = GetStringValue(host, "risk_level", "INFO");
					var os = GetStringValue(host, "os", "Unknown");
					var ttl = GetIntValue(host, "ttl", 0).ToString();
					
					// Emoji du niveau de risque
					var riskEmoji = riskLevel switch
					{
						"CRITIQUE" => "🔴",
						"ÉLEVÉ" => "🟠",
						"MOYEN" => "🟡",
						"FAIBLE" => "🟢",
						_ => "⚪"
					};
					
					// Extraire les ports ouverts (AOT-compatible)
					var openPortsList = new List<string>();
					if (host.TryGetProperty("open_ports", out var portsElement) && portsElement.ValueKind == JsonValueKind.Array)
					{
						foreach (var port in portsElement.EnumerateArray())
						{
							openPortsList.Add(port.ToString());
						}
					}
					
					resultText += $"┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n";
					resultText += $"┃ {riskEmoji} [{riskLevel}] {ip}";
					if (!string.IsNullOrEmpty(hostname))
						resultText += $" • {hostname}";
					resultText += "\n";
					resultText += $"┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n";
					
					// Informations système
					resultText += $"┃ 💻 INFORMATIONS SYSTÈME\n";
					resultText += $"┃ ├─ OS détecté : {os}\n";
					resultText += $"┃ ├─ TTL détecté : {ttl}\n";
					
					// Méthode de détection
					var detectionMethod = GetStringValue(host, "detection_method", "");
					if (!string.IsNullOrEmpty(detectionMethod))
					{
						var methodEmoji = detectionMethod switch
						{
							"ICMP" => "📡",
							"ARP" => "🔗",
							"TCP" => "🌐",
							_ => "❓"
						};
						resultText += $"┃ ├─ Méthode détection : {methodEmoji} {detectionMethod}\n";
					}
					
					if (!string.IsNullOrEmpty(mac) && mac != "N/A")
						resultText += $"┃ ├─ Adresse MAC : {mac}\n";
					resultText += $"┃ └─ Score de risque : {priorityScore}/100\n";
					resultText += $"┃\n";
					
					// Ports et services - affichage détaillé avec liens d'accès
					var portsCount = openPortsList.Count;
					resultText += $"┃ 🔓 PORTS OUVERTS AVEC ACCÈS DIRECT : {portsCount}\n";
					if (portsCount > 0)
					{
						resultText += $"┃ ┌────────────────────────────────────────\n";
						foreach (var portNum in openPortsList)
						{
							var serviceName = GetServiceName(portNum);
							var accessUrl = !string.IsNullOrEmpty(ip) ? GetAccessUrl(ip, portNum) : "";
							
							resultText += $"┃ │ • Port {portNum,-6} {serviceName}\n";
							if (!string.IsNullOrEmpty(accessUrl))
							{
								resultText += $"┃ │   🔗 {accessUrl}\n";
							}
							else
							{
								resultText += $"┃ │   ⚠️  Pas de lien d'accès pour ce port\n";
							}
						}
						resultText += $"┃ └────────────────────────────────────────\n";
					}
					else
					{
						resultText += $"┃ └─ Aucun port ouvert détecté\n";
					}
					resultText += $"┃\n";
					
					// Services critiques
					if (host.TryGetProperty("critical_services", out var criticalServices) && 
					    criticalServices.ValueKind == JsonValueKind.Array)
					{
						var servicesArray = criticalServices.EnumerateArray().ToList();
						if (servicesArray.Count > 0)
						{
							resultText += $"┃ ⚠️  SERVICES CRITIQUES EXPOSÉS\n";
							foreach (var svc in servicesArray)
							{
								var port = GetIntValue(svc, "port", 0);
								var risk = GetStringValue(svc, "risk", "Unknown");
								resultText += $"┃ ├─ Port {port}: {risk}\n";
							}
							resultText += $"┃\n";
						}
					}
					
					// Analyse des vulnérabilités
					if (host.TryGetProperty("security_risks", out var securityRisks) && 
					    securityRisks.ValueKind == JsonValueKind.Object)
					{
						var hasVulns = false;
						
						// Critical risks
						if (securityRisks.TryGetProperty("critical", out var criticalRisks) && 
						    criticalRisks.ValueKind == JsonValueKind.Array)
						{
							var criticalArray = criticalRisks.EnumerateArray().ToList();
							if (criticalArray.Count > 0)
							{
								hasVulns = true;
								resultText += $"┃ 🔴 VULNÉRABILITÉS CRITIQUES\n";
								foreach (var vuln in criticalArray)
								{
									var desc = GetStringValue(vuln, "description", 
									           GetStringValue(vuln, "vulnerability", "Vulnérabilité détectée"));
									resultText += $"┃ ├─ {desc}\n";
								}
							}
						}
						
						// High risks
						if (securityRisks.TryGetProperty("high", out var highRisks) && 
						    highRisks.ValueKind == JsonValueKind.Array)
						{
							var highArray = highRisks.EnumerateArray().ToList();
							if (highArray.Count > 0)
							{
								hasVulns = true;
								resultText += $"┃ 🟠 RISQUES ÉLEVÉS\n";
								foreach (var risk in highArray)
								{
									var desc = GetStringValue(risk, "description", "Risque détecté");
									resultText += $"┃ ├─ {desc}\n";
								}
							}
						}
						
						// Medium risks
						if (securityRisks.TryGetProperty("medium", out var mediumRisks) && 
						    mediumRisks.ValueKind == JsonValueKind.Array)
						{
							var mediumArray = mediumRisks.EnumerateArray().ToList();
							if (mediumArray.Count > 0)
							{
								hasVulns = true;
								resultText += $"┃ 🟡 RISQUES MOYENS\n";
								foreach (var risk in mediumArray)
								{
									var desc = risk.TryGetProperty("description", out var d) ? d.GetString() : "Risque détecté";
									resultText += $"┃ ├─ {desc}\n";
								}
							}
						}
						
						if (hasVulns)
							resultText += $"┃\n";
					}
					
					// Services web (AOT-compatible)
					string server = "", statusCode = "", httpsServer = "", httpsStatusCode = "";
					
					if (host.TryGetProperty("http", out var httpInfo) && httpInfo.ValueKind == JsonValueKind.Object)
					{
						server = GetStringValue(httpInfo, "server", "");
						statusCode = GetStringValue(httpInfo, "status_code", "");
					}
					
					if (host.TryGetProperty("http_https", out var httpsInfo) && httpsInfo.ValueKind == JsonValueKind.Object)
					{
						httpsServer = GetStringValue(httpsInfo, "server", "");
						httpsStatusCode = GetStringValue(httpsInfo, "status_code", "");
					}
					
					if (!string.IsNullOrEmpty(server) || !string.IsNullOrEmpty(httpsServer))
					{
						resultText += $"┃ 🌐 SERVICES WEB\n";
						if (!string.IsNullOrEmpty(server))
							resultText += $"┃ ├─ HTTP: {server} (Status: {statusCode})\n";
					if (!string.IsNullOrEmpty(httpsServer))
							resultText += $"┃ ├─ HTTPS: {httpsServer} (Status: {httpsStatusCode})\n";
					
						// TLS information (AOT-compatible)
						string tlsValid = "", tlsExpires = "";
						if (host.TryGetProperty("tls", out var tlsInfo) && tlsInfo.ValueKind == JsonValueKind.Object)
						{
							tlsValid = GetStringValue(tlsInfo, "valid", "");
							tlsExpires = GetIntValue(tlsInfo, "expires_in_days", 0).ToString();
						}
					
					if (!string.IsNullOrEmpty(tlsValid))
						{
							var tlsStatus = tlsValid == "True" ? "✅ Valide" : "⚠️ Invalide";
							resultText += $"┃ ├─ Certificat SSL: {tlsStatus}";
					
					if (!string.IsNullOrEmpty(tlsExpires) && tlsExpires != "")
								resultText += $" (Expire: {tlsExpires}j)";
						resultText += "\n";
						}
						
						// Interfaces d'administration exposées (AOT-compatible)
						if (host.TryGetProperty("http", out var httpInfoCheck) && 
						    httpInfoCheck.TryGetProperty("admin_panels", out var adminPanels) && 
						    adminPanels.ValueKind == JsonValueKind.Array)
						{
							var panelsArray = adminPanels.EnumerateArray().ToList();
							if (panelsArray.Count > 0)
							{
								resultText += $"┃ └─ 🚨 INTERFACES ADMIN EXPOSÉES ({panelsArray.Count})\n";
								foreach (var panel in panelsArray)
								{
									var panelUrl = panel.GetString();
									resultText += $"┃    • {panelUrl}\n";
								}
							}
						}
						resultText += $"┃\n";
					}
					
					// Banners (AOT-compatible)
					if (host.TryGetProperty("banners", out var banners) && banners.ValueKind == JsonValueKind.Object)
					{
						var bannerList = new List<(string key, string value)>();
						foreach (var prop in banners.EnumerateObject())
						{
							bannerList.Add((prop.Name, prop.Value.ToString()));
						}
						
						if (bannerList.Count > 0)
						{
							resultText += $"┃ 📋 BANNIÈRES DE SERVICES\n";
							foreach (var banner in bannerList.Take(3))
							{
								resultText += $"┃ ├─ Port {banner.key}: {banner.value}\n";
							}
							resultText += $"┃\n";
						}
					}
					
					// === NOUVELLES SECTIONS ===
					
					// CVE Analysis (AOT-compatible)
					if (host.TryGetProperty("cve_analysis", out var cveAnalysis) && 
					    cveAnalysis.ValueKind == JsonValueKind.Object)
					{
						if (cveAnalysis.TryGetProperty("total_cves", out var totalCves) && totalCves.GetInt32() > 0)
						{
							resultText += $"┃ 🔴 VULNÉRABILITÉS CVE DÉTECTÉES : {totalCves.GetInt32()}\n";
							
							// CVE critiques
							if (cveAnalysis.TryGetProperty("critical", out var criticalCves) && 
							    criticalCves.ValueKind == JsonValueKind.Array)
							{
								var criticalArray = criticalCves.EnumerateArray().ToList();
								if (criticalArray.Count > 0)
								{
									resultText += $"┃ ┌─ CRITIQUES :\n";
									foreach (var cve in criticalArray.Take(3))
									{
										var cveId = cve.TryGetProperty("cve_id", out var id) ? id.GetString() : "Unknown";
										var cvss = cve.TryGetProperty("cvss_score", out var score) ? score.GetDouble() : 0;
										var desc = cve.TryGetProperty("description", out var d) ? d.GetString() : "";
										resultText += $"┃ │  • {cveId} (CVSS: {cvss})\n";
										resultText += $"┃ │    {desc}\n";
									}
									resultText += $"┃ └────────────────────────────────────\n";
								}
							}
							
							// CVE high
							if (cveAnalysis.TryGetProperty("high", out var highCves) && 
							    highCves.ValueKind == JsonValueKind.Array)
							{
								var highArray = highCves.EnumerateArray().ToList();
								if (highArray.Count > 0)
								{
									resultText += $"┃ └─ HIGH : {highArray.Count} vulnérabilité(s)\n";
								}
							}
							resultText += $"┃\n";
						}
					}
					
					// Directory Scan (AOT-compatible)
					if (host.TryGetProperty("directory_scan", out var dirScan) && 
					    dirScan.ValueKind == JsonValueKind.Object)
					{
						if (dirScan.TryGetProperty("sensitive_files", out var sensitiveFiles) && 
						    sensitiveFiles.ValueKind == JsonValueKind.Array)
						{
							var filesArray = sensitiveFiles.EnumerateArray().ToList();
							if (filesArray.Count > 0)
							{
								resultText += $"┃ 🚨 FICHIERS SENSIBLES EXPOSÉS : {filesArray.Count}\n";
								foreach (var file in filesArray.Take(5))
								{
									var risk = file.TryGetProperty("risk", out var r) ? r.GetString() : "";
									var path = file.TryGetProperty("path", out var p) ? p.GetString() : "";
									var url = file.TryGetProperty("url", out var u) ? u.GetString() : "";
									resultText += $"┃ ├─ {risk}\n";
									resultText += $"┃ │  Fichier: {path}\n";
									resultText += $"┃ │  🔗 {url}\n";
								}
								resultText += $"┃\n";
							}
						}
						
						// Stats directory scan
						if (dirScan.TryGetProperty("found_paths", out var foundPaths) && foundPaths.GetInt32() > 0)
						{
							var found = foundPaths.GetInt32();
							var port = dirScan.TryGetProperty("port", out var p) ? p.GetInt32() : 0;
							resultText += $"┃ 📂 Directory Scan (Port {port}): {found} chemins découverts\n";
							resultText += $"┃\n";
						}
					}
					
					resultText += $"┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n";
				}
			}

			// Recommendations section
			resultText += $"╔════════════════════════════════════════════════╗\n";
			resultText += $"║        RECOMMANDATIONS DE SÉCURITÉ            ║\n";
			resultText += $"╚════════════════════════════════════════════════╝\n\n";
			
			if (criticalHosts > 0 || highRiskHosts > 0)
			{
				resultText += $"⚠️  ACTION IMMÉDIATE REQUISE\n";
				resultText += $"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
				
				if (criticalHosts > 0)
				{
					resultText += $"🔴 {criticalHosts} hôte(s) avec vulnérabilités CRITIQUES :\n";
					resultText += $"   • Corriger immédiatement les services exposés\n";
					resultText += $"   • Isoler du réseau si nécessaire\n";
					resultText += $"   • Appliquer les patches de sécurité\n\n";
				}
				
				if (highRiskHosts > 0)
				{
					resultText += $"🟠 {highRiskHosts} hôte(s) avec risques ÉLEVÉS :\n";
					resultText += $"   • Audit de sécurité approfondi recommandé\n";
					resultText += $"   • Renforcer les configurations\n";
					resultText += $"   • Activer les pare-feu et IDS/IPS\n\n";
				}
			}
			
			resultText += $"📋 BONNES PRATIQUES GÉNÉRALES\n";
			resultText += $"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
			resultText += $"✓ Fermer les ports non utilisés\n";
			resultText += $"✓ Utiliser des mots de passe forts\n";
			resultText += $"✓ Activer l'authentification à deux facteurs\n";
			resultText += $"✓ Maintenir tous les systèmes à jour\n";
			resultText += $"✓ Chiffrer les communications (HTTPS, SSH)\n";
			resultText += $"✓ Surveiller les logs et l'activité réseau\n";
			resultText += $"✓ Segmenter le réseau (VLANs)\n";
			resultText += $"✓ Effectuer des scans réguliers\n\n";
			
			// Summary
			resultText += $"╔════════════════════════════════════════════════╗\n";
			resultText += $"║              RÉSUMÉ DE L'AUDIT                ║\n";
			resultText += $"╚════════════════════════════════════════════════╝\n\n";
			resultText += $"📊 {results.GetArrayLength()} adresses IP analysées\n";
			resultText += $"✅ {aliveHosts.Count} hôtes actifs découverts\n";
			resultText += $"❌ {deadHosts.Count} hôtes hors ligne\n";
			resultText += $"🔴 {criticalHosts} hôtes critiques\n";
			resultText += $"🟠 {highRiskHosts} hôtes à risque élevé\n\n";
			resultText += $"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
			resultText += $"✅ Analyse de pentest terminée avec succès\n";
			resultText += $"🛡️  PathFinder Professional Security Scanner\n";

			return resultText;
		}
		catch (Exception ex)
		{
			Debug.WriteLine($"❌ ERREUR ParseScanResults: {ex.Message}");
			Debug.WriteLine($"   Stack: {ex.StackTrace}");
			Debug.WriteLine($"   Type: {ex.GetType().Name}");
			
			return $"❌ ERREUR DE TRAITEMENT\n\n{ex.Message}\n\n{ex.GetType().Name}\n\nImpossible d'analyser les résultats du scan.\n\nVoir Console.app pour détails.";
		}
	}

	private async Task CopyAssetToCache(string assetPath, string destinationPath)
	{
		try
		{
			using var stream = await FileSystem.OpenAppPackageFileAsync(assetPath);
			using var fileStream = File.Create(destinationPath);
			await stream.CopyToAsync(fileStream);
		}
		catch (Exception ex)
		{
			throw new Exception($"Failed to copy asset {assetPath}: {ex.Message}");
		}
	}

	private async Task CopyAssetToTemp(string assetPath, string destinationPath)
	{
		try
		{
			using var stream = await FileSystem.OpenAppPackageFileAsync(assetPath);
			using var fileStream = File.Create(destinationPath);
			await stream.CopyToAsync(fileStream);
		}
		catch (Exception ex)
		{
			throw new Exception($"Échec de la copie du fichier {assetPath}: {ex.Message}");
		}
	}

	private string GetServiceName(string port)
	{
		return port switch
		{
			"20" => "→ FTP Data",
			"21" => "→ FTP Control",
			"22" => "→ SSH",
			"23" => "→ Telnet",
			"25" => "→ SMTP",
			"53" => "→ DNS",
			"80" => "→ HTTP",
			"110" => "→ POP3",
			"111" => "→ RPC",
			"135" => "→ MS-RPC",
			"139" => "→ NetBIOS",
			"143" => "→ IMAP",
			"443" => "→ HTTPS",
			"445" => "→ SMB/CIFS",
			"465" => "→ SMTPS",
			"587" => "→ SMTP/TLS",
			"993" => "→ IMAPS",
			"995" => "→ POP3S",
			"1433" => "→ MS SQL Server",
			"1521" => "→ Oracle DB",
			"3306" => "→ MySQL",
			"3389" => "→ RDP (Remote Desktop)",
			"5000" => "→ UPnP",
			"5001" => "→ Synology DSM",
			"5432" => "→ PostgreSQL",
			"5900" => "→ VNC",
			"5985" => "→ WinRM HTTP",
			"5986" => "→ WinRM HTTPS",
			"6379" => "→ Redis",
			"8000" => "→ HTTP Alternate",
			"8080" => "→ HTTP Proxy",
			"8443" => "→ HTTPS Alternate",
			"8888" => "→ HTTP Alternate",
			"9090" => "→ WebSocket",
			"9200" => "→ Elasticsearch",
			"9300" => "→ Elasticsearch Cluster",
			"11211" => "→ Memcached",
			"27017" => "→ MongoDB",
			"27018" => "→ MongoDB Shard",
			"50000" => "→ SAP",
			_ => ""
		};
	}

	private string GetAccessUrl(string ip, string port)
	{
		return port switch
		{
			// Services Web HTTP
			"80" => $"http://{ip}/",
			"8000" => $"http://{ip}:8000/",
			"8080" => $"http://{ip}:8080/",
			"8888" => $"http://{ip}:8888/",
			"5000" => $"http://{ip}:5000/",
			"9090" => $"http://{ip}:9090/",
			"3000" => $"http://{ip}:3000/",
			"4000" => $"http://{ip}:4000/",
			"9000" => $"http://{ip}:9000/",
			"10000" => $"http://{ip}:10000/",
			
			// Services Web HTTPS
			"443" => $"https://{ip}/",
			"8443" => $"https://{ip}:8443/",
			"5986" => $"https://{ip}:5986/",
			"9443" => $"https://{ip}:9443/",
			
			// Bases de données (interfaces web courantes)
			"3306" => $"http://{ip}/phpmyadmin (si installé)",
			"5432" => $"http://{ip}/pgadmin (si installé)",
			"27017" => $"http://{ip}:8081/ (mongo-express)",
			"9200" => $"http://{ip}:9200/ (Elasticsearch)",
			"6379" => $"http://{ip}/phpredisadmin (si installé)",
			"5984" => $"http://{ip}:5984/ (CouchDB)",
			"11211" => $"http://{ip}/phpMemcachedAdmin (si installé)",
			
			// Services avec interfaces web
			"5001" => $"https://{ip}:5001/ (Synology DSM)",
			"5985" => $"http://{ip}:5985/ (WinRM)",
			"10001" => $"https://{ip}:10001/ (Webmin)",
			"10002" => $"https://{ip}:10002/ (Virtualmin)",
			
			// Services à connexion spéciale
			"21" => $"ftp://{ip}/",
			"22" => $"ssh {ip}",
			"23" => $"telnet {ip}",
			"3389" => $"rdp://{ip}/ (Remote Desktop)",
			"5900" => $"vnc://{ip}:5900/ (VNC)",
			"5901" => $"vnc://{ip}:5901/ (VNC)",
			"5902" => $"vnc://{ip}:5902/ (VNC)",
			
			// Services réseau (pas d'URL web)
			"25" => $"Connexion SMTP: {ip}:25",
			"53" => $"DNS: {ip}:53",
			"110" => $"POP3: {ip}:110",
			"143" => $"IMAP: {ip}:143",
			"445" => $"SMB: \\\\{ip}\\",
			"1433" => $"SQL Server: {ip}:1433",
			"993" => $"IMAPS: {ip}:993",
			"995" => $"POP3S: {ip}:995",
			"587" => $"SMTP: {ip}:587",
			"465" => $"SMTPS: {ip}:465",
			
			// Services supplémentaires
			"135" => $"RPC: {ip}:135",
			"139" => $"NetBIOS: {ip}:139",
			"161" => $"SNMP: {ip}:161",
			"162" => $"SNMP Trap: {ip}:162",
			"389" => $"LDAP: {ip}:389",
			"636" => $"LDAPS: {ip}:636",
			
			_ => ""
		};
	}
}
