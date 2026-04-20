using Microsoft.Maui.Controls.Shapes;

namespace PathFinder;

public partial class ScheduledScansPage : ContentPage
{
	private string? _editingId;

	public ScheduledScansPage()
	{
		InitializeComponent();
		ModePicker.SelectedIndex = 0;
		FrequencyPicker.SelectedIndex = 1;
		DayOfWeekPicker.SelectedIndex = 1;
		UpdateFrequencyVisibility();
		RefreshList();
	}

	private void OnFrequencyChanged(object? sender, EventArgs e) => UpdateFrequencyVisibility();

	private void UpdateFrequencyVisibility()
	{
		var idx = FrequencyPicker.SelectedIndex;
		bool hourly = idx == 0;
		bool weekly = idx == 2;
		TimeRow.IsVisible = !hourly;
		DayOfWeekCol.IsVisible = weekly;
	}

	private void ResetForm()
	{
		_editingId = null;
		FormTitleLabel.Text = "➕ Nouveau scan programmé";
		CancelButton.IsVisible = false;
		TargetsEditor.Text = "";
		ModePicker.SelectedIndex = 0;
		FrequencyPicker.SelectedIndex = 1;
		DayOfWeekPicker.SelectedIndex = 1;
		TimePickerUI.Time = new TimeSpan(3, 0, 0);
		EnabledCheck.IsChecked = true;
		UpdateFrequencyVisibility();
	}

	private async void OnSaveClicked(object? sender, EventArgs e)
	{
		var targets = (TargetsEditor.Text ?? "").Trim();
		if (string.IsNullOrWhiteSpace(targets))
		{
			await DisplayAlert("Champ manquant", "Indiquez au moins une cible.", "OK");
			return;
		}

		var schedule = new ScheduledScan
		{
			Id = _editingId ?? Guid.NewGuid().ToString("N"),
			Targets = targets,
			Mode = ModePicker.SelectedIndex switch
			{
				1 => ScanMode.Full,
				2 => ScanMode.Stealth,
				_ => ScanMode.Fast
			},
			Frequency = FrequencyPicker.SelectedIndex switch
			{
				0 => ScheduleFrequency.Hourly,
				2 => ScheduleFrequency.Weekly,
				_ => ScheduleFrequency.Daily
			},
			TimeOfDay = TimePickerUI.Time,
			DayOfWeek = DayOfWeekPicker.SelectedIndex < 0 ? 1 : DayOfWeekPicker.SelectedIndex,
			Enabled = EnabledCheck.IsChecked
		};
		schedule.NextRunAt = schedule.ComputeNextRun();

		ScheduleService.Upsert(schedule);

		// Enregistrement comme vraie tâche système (launchd/schtasks) si possible.
		// Le timer in-process (ScheduleService) reste la sécurité fallback.
		var systemStatus = "";
		if (SystemScheduler.IsSupported && schedule.Enabled)
		{
			if (SystemScheduler.Install(schedule, out var msg))
				systemStatus = "\n✅ Scheduler OS activé : le scan tournera même app fermée.";
			else
				systemStatus = $"\n⚠️ Scheduler OS indisponible ({msg}). Le scan ne tournera que si PathFinder est ouverte.";
		}
		else if (!schedule.Enabled && SystemScheduler.IsSupported)
		{
			SystemScheduler.Uninstall(schedule.Id, out string _unused);
		}

		ResetForm();
		RefreshList();

		await DisplayAlert("✅ Enregistré",
			$"Prochain lancement : {schedule.NextRunAt:dd/MM/yyyy HH:mm}{systemStatus}",
			"OK");
	}

	private void OnCancelClicked(object? sender, EventArgs e) => ResetForm();

	private void RefreshList()
	{
		SchedulesList.Children.Clear();
		var items = ScheduleService.Load();
		EmptyLabel.IsVisible = items.Count == 0;

		foreach (var s in items.OrderBy(x => x.NextRunAt))
		{
			SchedulesList.Children.Add(BuildCard(s));
		}
	}

	private View BuildCard(ScheduledScan s)
	{
		var title = new Label
		{
			Text = $"🎯 {s.Targets.Replace('\n', ' ').Trim()}",
			FontSize = 14,
			FontAttributes = FontAttributes.Bold,
			TextColor = Color.FromArgb("#E2E8F0"),
			LineBreakMode = LineBreakMode.TailTruncation
		};

		var modeBadge = new Label
		{
			Text = s.Mode switch
			{
				ScanMode.Full => "🔎 Complet",
				ScanMode.Stealth => "🥷 Furtif",
				_ => "⚡ Rapide"
			},
			FontSize = 11,
			TextColor = Color.FromArgb(s.Mode switch
			{
				ScanMode.Full => "#F59E0B",
				ScanMode.Stealth => "#8B5CF6",
				_ => "#06B6D4"
			}),
			FontAttributes = FontAttributes.Bold
		};

		var freq = new Label
		{
			Text = s.DescribeFrequency(),
			FontSize = 12,
			TextColor = Color.FromArgb("#94A3B8")
		};

		var nextRun = new Label
		{
			Text = $"⏱ Prochain : {s.NextRunAt:dd/MM HH:mm}" + (s.LastRunAt.HasValue ? $"   •   Dernier : {s.LastRunAt:dd/MM HH:mm}" : ""),
			FontSize = 11,
			TextColor = Color.FromArgb("#64748B")
		};

		var statusBadge = new Label
		{
			Text = s.Enabled ? "● Actif" : "○ Désactivé",
			FontSize = 11,
			TextColor = Color.FromArgb(s.Enabled ? "#10B981" : "#64748B"),
			FontAttributes = FontAttributes.Bold
		};

		var editBtn = new Button
		{
			Text = "✏️",
			FontSize = 14,
			WidthRequest = 44,
			HeightRequest = 36,
			CornerRadius = 8,
			Padding = 0,
			BackgroundColor = Color.FromArgb("#334155"),
			TextColor = Colors.White
		};
		editBtn.Clicked += (_, __) => LoadForEdit(s);

		var toggleBtn = new Button
		{
			Text = s.Enabled ? "⏸️" : "▶️",
			FontSize = 14,
			WidthRequest = 44,
			HeightRequest = 36,
			CornerRadius = 8,
			Padding = 0,
			BackgroundColor = Color.FromArgb(s.Enabled ? "#F59E0B" : "#10B981"),
			TextColor = Colors.White
		};
		toggleBtn.Clicked += (_, __) =>
		{
			s.Enabled = !s.Enabled;
			if (s.Enabled) s.NextRunAt = s.ComputeNextRun();
			ScheduleService.Upsert(s);
			RefreshList();
		};

		var deleteBtn = new Button
		{
			Text = "🗑",
			FontSize = 14,
			WidthRequest = 44,
			HeightRequest = 36,
			CornerRadius = 8,
			Padding = 0,
			BackgroundColor = Color.FromArgb("#EF4444"),
			TextColor = Colors.White
		};
		deleteBtn.Clicked += async (_, __) =>
		{
			bool confirm = await DisplayAlert("Supprimer", "Confirmer la suppression de ce scan programmé ?", "Oui", "Non");
			if (confirm)
			{
				ScheduleService.Delete(s.Id);
				if (SystemScheduler.IsSupported)
					SystemScheduler.Uninstall(s.Id, out string _unused);
				RefreshList();
			}
		};

		var actions = new HorizontalStackLayout
		{
			Spacing = 6,
			HorizontalOptions = LayoutOptions.End
		};
		actions.Add(editBtn);
		actions.Add(toggleBtn);
		actions.Add(deleteBtn);

		var metaRow = new HorizontalStackLayout { Spacing = 12 };
		metaRow.Add(modeBadge);
		metaRow.Add(freq);
		metaRow.Add(statusBadge);

		var stack = new VerticalStackLayout { Spacing = 6 };
		stack.Add(title);
		stack.Add(metaRow);
		stack.Add(nextRun);
		stack.Add(actions);

		var card = new Border
		{
			BackgroundColor = Color.FromArgb("#1A1A2E"),
			Padding = new Thickness(14, 12),
			StrokeThickness = 1,
			Stroke = Color.FromArgb(s.Enabled ? "#10B981" : "#334155"),
			StrokeShape = new RoundRectangle { CornerRadius = 10 },
			Content = stack
		};

		return card;
	}

	private void LoadForEdit(ScheduledScan s)
	{
		_editingId = s.Id;
		FormTitleLabel.Text = "✏️ Modifier la planification";
		CancelButton.IsVisible = true;

		TargetsEditor.Text = s.Targets;
		ModePicker.SelectedIndex = s.Mode switch
		{
			ScanMode.Full => 1,
			ScanMode.Stealth => 2,
			_ => 0
		};
		FrequencyPicker.SelectedIndex = s.Frequency switch
		{
			ScheduleFrequency.Hourly => 0,
			ScheduleFrequency.Weekly => 2,
			_ => 1
		};
		TimePickerUI.Time = s.TimeOfDay;
		DayOfWeekPicker.SelectedIndex = Math.Clamp(s.DayOfWeek, 0, 6);
		EnabledCheck.IsChecked = s.Enabled;
		UpdateFrequencyVisibility();
	}
}
