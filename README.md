# SolarEdge Monitoring System

Automated system to monitor SolarEdge photovoltaic installations using Playwright for login and data extraction. Designed to detect anomalies in power consumption patterns, particularly for hot water circuit operation (~3kW draw between 10am-2pm), to provide early warning of electrical issues before they require emergency service calls.

## Features

- �� 🔐 Secure login to SolarEdge monitoring portal using credentials stored in GitHub Secrets
- �� 🤖 Automated data extraction using Playwright browser automation
- �� ⏰ Scheduled data collection via GitHub Actions (every 15-30 minutes during daylight hours)
- �� 📊 Data storage and historical tracking in repository
- �� 🚨 Alerting for missing expected power draw patterns (hot water circuit)
- �� 🌐 Visualization dashboard hosted on GitHub Pages
- �� 📈 Real-time and historical graphs of solar production/consumption
- �� ⚠��️ Early detection of electrical issues to avoid weekend call-out fees

## How It Works

1. **Authentication**: Uses GitHub repository secrets (SOLAREDGE_USERNAME and SOLAREDGE_PASSWORD) to securely login to SolarEdge monitoring portal
2. **Data Extraction**: Playwright navigates the SolarEdge website to extract:
   - Real-time power production and consumption
   - Historical energy data
   - Circuit-level power draw (when available)
3. **Analysis**: Compares current data against expected patterns:
   - Hot water circuit should show ~3kW draw between 10am-2pm on expected days
   - Deviations trigger alerts
4. **Storage**: Data is committed to the repository for historical tracking
5. **Visualization**: GitHub Pages site displays:
   - Current power production/consumption gauges
   - Historical daily/weekly/monthly graphs
   - Alert status and notification history

## Setup

### Prerequisites
- GitHub account
- SolarEdge monitoring portal credentials (username/password)
- Node.js (for local development/testing)

### Configuration

1. **Fork or clone this repository**
2. **Add secrets to your repository**:
   - Go to Settings > Secrets and variables > Actions
   - Add:
     - `SOLAREDGE_USERNAME`: Your SolarEdge monitoring portal username
     - `SOLAREDGE_PASSWORD`: Your SolarEdge monitoring portal password
3. **Enable GitHub Actions** (if not already enabled)
4. **Enable GitHub Pages** in repository settings to serve the `public/` directory

## Project Structure

```
solaredge-monitor/
├── .github/
│   └── workflows/
│       └── monitor.yml          # GitHub Actions workflow for data collection & dashboard deployment
├── scripts/
│   ├── monitor.js               # Main Playwright monitoring script
│   ├── extract-data.js          # Data extraction helpers
│   ├── analyze-patterns.js      # Anomaly detection logic
│   └── generate-dashboard.js    # Dashboard HTML generation
├── data/
│   ├── historical.json          # Stored historical data (git-tracked)
│   └── latest.json              # Most recent data snapshot
├── public/
│   ├── index.html               # Dashboard homepage
│   ├── style.css                # Styles for dashboard
│   ├── script.js                # Frontend dashboard logic
│   └── chart.js                 # Charting library (Chart.js)
├── README.md                    # This file
�└── package.json                 # Node.js dependencies and scripts
```

## Data Collection Schedule

The monitoring script runs on a cron schedule optimized for solar detection:
- Every 20 minutes during daylight hours (6am-8pm)
- Once per hour during nighttime hours (8pm-6am)
- Adjustable based on your location and seasonal daylight variations

## Alerting System

When the system detects anomalies:
- Creates a GitHub Issue in the repository
- Can be extended to send notifications via:
  - Email (using GitHub Actions email integrations)
  - Webhook to services like Discord, Slack, or Telegram
  - SMS via Twilio or similar services

Primary alert condition:
- Missing expected ~3kW draw from hot water circuit between 10am-2p on days when hot water usage is expected

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run the monitor script locally (for testing)
node scripts/monitor.js

# Generate dashboard locally
node scripts/generate-dashboard.js
```

### Playwright Setup

First-time setup requires installing browsers:
```bash
npx playwright install
```

## Privacy & Security Notes

- Credentials are never stored in the repository - only in GitHub Secrets
- The system only reads data from SolarEdge portal - no modifications are made
- Historical data is stored in a public repository - consider this when deciding what to track
- For maximum privacy, consider using a private repository

## Extensions & Customization

- Add additional alert conditions (sudden production drops, unexpected consumption)
- Integrate with home automation systems (Home Assistant, etc.)
- Add weather data correlation for more accurate solar production expectations
- Implement predictive maintenance alerts based on trends
- Add multi-system support for monitoring multiple SolarEdge installations

## License

MIT License - feel free to adapt and extend for your own monitoring needs.