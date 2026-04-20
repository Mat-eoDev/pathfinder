using System.Text.Json;
using System.Text.Json.Nodes;

namespace PathFinder;

public enum ScanMode { Fast, Full, Stealth }

public enum ScheduleFrequency { Hourly, Daily, Weekly }

public class ScheduledScan
{
	public string Id { get; set; } = Guid.NewGuid().ToString("N");
	public string Targets { get; set; } = "";
	public ScanMode Mode { get; set; } = ScanMode.Fast;
	public ScheduleFrequency Frequency { get; set; } = ScheduleFrequency.Daily;
	public TimeSpan TimeOfDay { get; set; } = new TimeSpan(3, 0, 0);
	public int DayOfWeek { get; set; } = 1;
	public bool Enabled { get; set; } = true;
	public DateTime? LastRunAt { get; set; }
	public DateTime NextRunAt { get; set; } = DateTime.Now.AddMinutes(5);

	public JsonObject ToJson()
	{
		var o = new JsonObject
		{
			["id"] = Id,
			["targets"] = Targets,
			["mode"] = Mode switch { ScanMode.Full => "full", ScanMode.Stealth => "stealth", _ => "fast" },
			["frequency"] = Frequency switch { ScheduleFrequency.Hourly => "hourly", ScheduleFrequency.Weekly => "weekly", _ => "daily" },
			["time"] = $"{TimeOfDay.Hours:D2}:{TimeOfDay.Minutes:D2}",
			["dow"] = DayOfWeek,
			["enabled"] = Enabled,
			["lastRunAt"] = LastRunAt?.ToString("o"),
			["nextRunAt"] = NextRunAt.ToString("o")
		};
		return o;
	}

	public static ScheduledScan FromJson(JsonNode node)
	{
		var o = node.AsObject();
		var s = new ScheduledScan
		{
			Id = (string?)o["id"] ?? Guid.NewGuid().ToString("N"),
			Targets = (string?)o["targets"] ?? "",
			Mode = (string?)o["mode"] switch { "full" => ScanMode.Full, "stealth" => ScanMode.Stealth, _ => ScanMode.Fast },
			Frequency = (string?)o["frequency"] switch
			{
				"hourly" => ScheduleFrequency.Hourly,
				"weekly" => ScheduleFrequency.Weekly,
				_ => ScheduleFrequency.Daily
			},
			DayOfWeek = (int?)o["dow"] ?? 1,
			Enabled = (bool?)o["enabled"] ?? true
		};

		var time = (string?)o["time"] ?? "03:00";
		if (TimeSpan.TryParse(time, out var ts)) s.TimeOfDay = ts;

		var last = (string?)o["lastRunAt"];
		if (!string.IsNullOrEmpty(last) && DateTime.TryParse(last, out var lastDt))
			s.LastRunAt = lastDt;

		var next = (string?)o["nextRunAt"];
		if (!string.IsNullOrEmpty(next) && DateTime.TryParse(next, out var nextDt))
			s.NextRunAt = nextDt;

		return s;
	}

	public DateTime ComputeNextRun(DateTime? from = null)
	{
		var baseTime = from ?? DateTime.Now;
		switch (Frequency)
		{
			case ScheduleFrequency.Hourly:
				return baseTime.AddHours(1);
			case ScheduleFrequency.Daily:
			{
				var today = baseTime.Date.Add(TimeOfDay);
				return today > baseTime ? today : today.AddDays(1);
			}
			case ScheduleFrequency.Weekly:
			{
				var target = this.DayOfWeek % 7;
				var candidate = baseTime.Date.Add(TimeOfDay);
				int delta = (target - (int)candidate.DayOfWeek + 7) % 7;
				candidate = candidate.AddDays(delta);
				if (candidate <= baseTime) candidate = candidate.AddDays(7);
				return candidate;
			}
		}
		return baseTime.AddDays(1);
	}

	public string DescribeFrequency()
	{
		return Frequency switch
		{
			ScheduleFrequency.Hourly => "Toutes les heures",
			ScheduleFrequency.Weekly => $"Chaque {DayNames[this.DayOfWeek % 7]} à {TimeOfDay:hh\\:mm}",
			_ => $"Tous les jours à {TimeOfDay:hh\\:mm}"
		};
	}

	private static readonly string[] DayNames = { "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi" };
}
