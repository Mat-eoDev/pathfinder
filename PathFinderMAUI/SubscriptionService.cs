using Microsoft.Maui.Storage;

namespace PathFinder;

/// <summary>
/// Service centralisant l'accès au tier d'abonnement de l'utilisateur.
/// Les valeurs sont persistées par <see cref="LoginPage"/> après le login et peuvent
/// être rafraîchies via <see cref="RefreshAsync"/>.
/// </summary>
public static class SubscriptionService
{
    public const string TierFree = "free";
    public const string TierPro = "pro";
    public const string TierEnterprise = "enterprise";

    public static string CurrentTier
        => (Preferences.Get("subscription_tier", TierFree) ?? TierFree).ToLowerInvariant();

    public static bool IsPro      => CurrentTier == TierPro || CurrentTier == TierEnterprise;
    public static bool IsEnterprise => CurrentTier == TierEnterprise;

    /// <summary>
    /// Modes de scan autorisés selon le tier. C'est une copie locale du mapping
    /// serveur ; le serveur reste la source de vérité et bloquera un scan
    /// non autorisé (HTTP 402).
    /// </summary>
    public static bool CanUseMode(string mode)
    {
        var m = (mode ?? "fast").ToLowerInvariant();
        return CurrentTier switch
        {
            TierEnterprise => true,                   // fast + full + stealth
            TierPro        => m == "fast" || m == "full",
            _              => m == "fast",
        };
    }

    public static string TierLabel => CurrentTier switch
    {
        TierEnterprise => "Enterprise",
        TierPro        => "Pro",
        _              => "Free",
    };

    public static string TierEmoji => CurrentTier switch
    {
        TierEnterprise => "💎",
        TierPro        => "⭐",
        _              => "🆓",
    };

    /// <summary>
    /// Ré-interroge /api/subscription/me pour mettre à jour le tier (utile si
    /// l'utilisateur vient de souscrire côté web pendant la session MAUI).
    /// </summary>
    public static async Task<bool> RefreshAsync(string apiUrl, HttpClient http = null)
    {
        var token = Preferences.Get("auth_token", "");
        if (string.IsNullOrEmpty(token)) return false;
        http ??= new HttpClient();
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{apiUrl}/subscription/me");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode) return false;
            var body = await resp.Content.ReadAsStringAsync();
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("tier", out var t))
                Preferences.Set("subscription_tier", t.GetString() ?? TierFree);
            if (doc.RootElement.TryGetProperty("ends_at", out var e) && e.ValueKind == System.Text.Json.JsonValueKind.String)
                Preferences.Set("subscription_ends_at", e.GetString() ?? "");
            if (doc.RootElement.TryGetProperty("auto_renew", out var ar))
                Preferences.Set("subscription_auto_renew", ar.GetBoolean());
            return true;
        }
        catch
        {
            return false;
        }
    }
}
