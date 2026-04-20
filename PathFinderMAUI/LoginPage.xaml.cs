using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace PathFinder;

public partial class LoginPage : ContentPage
{
	private const string API_URL = "http://localhost:5001/api";
	private readonly HttpClient httpClient;
	
	public LoginPage()
	{
		InitializeComponent();
		httpClient = new HttpClient();
	}

	private async void OnLoginClicked(object sender, EventArgs e)
	{
		var email = EmailEntry.Text?.Trim();
		var password = PasswordEntry.Text;
		
		if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
		{
			ShowError("Veuillez remplir tous les champs");
			return;
		}
		
		LoginButton.IsEnabled = false;
		LoginButton.Text = "⏳ CONNEXION...";
		ErrorLabel.IsVisible = false;
		
		try
		{
			var loginData = new
			{
				email = email,
				password = password
			};
			
			var json = JsonSerializer.Serialize(loginData);
			var content = new StringContent(json, Encoding.UTF8, "application/json");
			
			var response = await httpClient.PostAsync($"{API_URL}/login", content);
			var responseBody = await response.Content.ReadAsStringAsync();
			
			if (response.IsSuccessStatusCode)
			{
				var result = JsonSerializer.Deserialize<LoginResponse>(responseBody);
				
				if (result != null && !string.IsNullOrEmpty(result.token))
				{
					// Sauvegarder le token et les infos utilisateur
					Preferences.Set("auth_token", result.token);
					Preferences.Set("user_email", result.user.email);
					Preferences.Set("user_username", result.user.username);
					Preferences.Set("user_id", result.user.id);

					// Tier d'abonnement (free / pro / enterprise) et date de fin.
					var tier = result.user.subscription?.tier ?? "free";
					Preferences.Set("subscription_tier", tier);
					Preferences.Set("subscription_ends_at",
						result.user.subscription?.ends_at ?? string.Empty);
					Preferences.Set("subscription_auto_renew",
						result.user.subscription?.auto_renew ?? true);

					// Persiste le token sur disque pour que les runners
					// de scans planifiés (lancés par launchd/schtasks) s'authentifient.
					try { SystemScheduler.PersistAuth(API_URL, result.token); }
					catch { /* best-effort, n'empêche pas la connexion */ }
					
					// Navigation vers la page principale
					await Navigation.PushAsync(new MainPage());
					
					// Retirer la page de login de la pile
					Navigation.RemovePage(this);
				}
				else
				{
					ShowError("Réponse invalide du serveur");
				}
			}
			else
			{
				var error = JsonSerializer.Deserialize<ErrorResponse>(responseBody);
				ShowError(error?.message ?? "Erreur de connexion");
			}
		}
		catch (HttpRequestException)
		{
			ShowError("Impossible de se connecter au serveur.\nVérifiez que l'API tourne sur http://localhost:5000");
		}
		catch (Exception ex)
		{
			ShowError($"Erreur : {ex.Message}");
		}
		finally
		{
			LoginButton.IsEnabled = true;
			LoginButton.Text = "🔓 SE CONNECTER";
		}
	}

	private async void OnRegisterTapped(object sender, EventArgs e)
	{
		bool answer = await DisplayAlert(
			"Créer un compte", 
			"Pour créer un compte, rendez-vous sur :\n\nhttp://localhost:5000\n\nOuvrir dans le navigateur ?", 
			"Ouvrir", 
			"Annuler"
		);
		
		if (answer)
		{
			try
			{
				await Launcher.OpenAsync("http://localhost:5000");
			}
			catch (Exception ex)
			{
				await DisplayAlert("Erreur", $"Impossible d'ouvrir le navigateur : {ex.Message}", "OK");
			}
		}
	}

	private void ShowError(string message)
	{
		ErrorLabel.Text = $"❌ {message}";
		ErrorLabel.IsVisible = true;
	}
	
	// Classes pour la désérialisation JSON
	private class LoginResponse
	{
		public string message { get; set; }
		public string token { get; set; }
		public UserInfo user { get; set; }
	}
	
	private class UserInfo
	{
		public int id { get; set; }
		public string email { get; set; }
		public string username { get; set; }
		public SubscriptionInfo subscription { get; set; }
	}

	private class SubscriptionInfo
	{
		public string tier { get; set; }
		public string ends_at { get; set; }
		public bool auto_renew { get; set; } = true;
	}

	private class ErrorResponse
	{
		public string message { get; set; }
	}
}

