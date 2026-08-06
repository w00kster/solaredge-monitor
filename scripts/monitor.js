const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function monitorSolarEdge() {
  console.log('Starting SolarEdge monitoring...');

  // Get credentials from environment variables (GitHub Secrets)
  const username = process.env.SOLAREDGE_USERNAME;
  const password = process.env.SOLAREDGE_PASSWORD;

  if (!username || !password) {
    console.error('ERROR: SolarEdge credentials not found in environment variables');
    console.error('Please set SOLAREDGE_USERNAME and SOLAREDGE_PASSWORD secrets');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1280, height: 720 });

    // Navigate to SolarEdge login page
    console.log('Navigating to SolarEdge monitoring portal...');
    await page.goto('https://monitoring.solaredge.com/mfe/auth/', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait for login button to appear (Sign in / Log in)
    const signInButton = page.locator('text=/Sign in|Log in/i').first();
    await signInButton.waitFor({ state: 'visible', timeout: 20000 });
    await signInButton.click();
    // Wait for login form and fill credentials
    // Wait for login form and fill credentials
    console.log('Filling login credentials...');
    // Wait for password field to appear
    const inputs = page.locator('input:visible');
    await inputs.first().waitFor({ state: 'visible', timeout: 20000 });
    await inputs.first().fill(username);
    await inputs.nth(1).waitFor({ state: 'visible', timeout: 20000 });
    await inputs.nth(1).fill(password);

    // Click login button
    await page.click('button:has-text("Log In"), button:has-text("Sign in")');

    // Wait for login to complete and dashboard to load
    console.log('Waiting for login to complete...');
    await page.waitForURL('**/one#/site-list**', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Extract data from the dashboard
    console.log('Extracting solar data...');
    const data = await extractSolarData(page);

    // Save data to files
    await saveData(data);

    // Check for anomalies and create alerts if needed
    await checkForAnomalies(data);

    console.log('Monitoring completed successfully');

  } catch (error) {
    console.error('Error during monitoring:', error);
    // Create a GitHub issue for monitoring failures
    await createMonitoringIssue(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function extractSolarData(page) {
  // Wait for data to load on dashboard
  await page.waitForTimeout(5000); // Allow time for charts/widgets to load

  // Extract current power data
  const currentPower = await extractCurrentPower(page);
  const todayEnergy = await extractTodayEnergy(page);

  // Try to extract circuit-level data if available
  const circuitData = await extractCircuitData(page);

  const timestamp = new Date().toISOString();

  return {
    timestamp,
    currentPower: currentPower || 0, // kW
    todayEnergy: todayEnergy || 0,   // kWh
    circuits: circuitData || [],
    rawData: {
      // Additional raw data points can be added here
    }
  };
}

async function extractCurrentPower(page) {
  try {
    // Try to find current power display - this will vary based on SolarEdge UI
    // Common selectors for power displays
    const selectors = [
      '.power-value',
      '[data-testid="current-power"]',
      '.current-power',
      '.site-power-value',
      'text=/[\d,]+\.?\d*\s*kW/i'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          // Extract numeric value from text
          const match = text.match(/([\d,]+\.?\d*)/);
          if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If we can't find it via selectors, try to extract from charts
    return await extractPowerFromChart(page);
  } catch (error) {
    console.warn('Could not extract current power:', error.message);
    return null;
  }
}

async function extractTodayEnergy(page) {
  try {
    const selectors = [
      '.energy-value',
      '[data-testid="today-energy"]',
      '.today-energy',
      '.daily-energy-value',
      'text=/[\d,]+\.?\d*\s*kWh/i'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          const match = text.match(/([\d,]+\.?\d*)/);
          if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    return null;
  } catch (error) {
    console.warn('Could not extract today energy:', error.message);
    return null;
  }
}

async function extractCircuitData(page) {
  try {
    // Try to navigate to circuits/devices section or extract from dashboard
    // This is highly dependent on the specific SolarEdge installation and UI

    // Look for circuit/power distribution information
    const circuitSelectors = [
      '.circuit-power',
      '[data-testid*="circuit"]',
      '.power-distribution',
      '.device-power'
    ];

    const circuits = [];

    for (const selector of circuitSelectors) {
      try {
        const elements = await page.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const text = await element.textContent();

            // Try to extract circuit name and power value
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            // Simple parsing - this would need to be adapted to actual UI
            if (lines.length >= 2) {
              const name = lines[0];
              const powerMatch = lines[1].match(/([\d,]+\.?\d*)\s*kW/i);
              if (powerMatch) {
                circuits.push({
                  name: name,
                  power: parseFloat(powerMatch[1].replace(/,/g, '')),
                  timestamp: new Date().toISOString()
                });
              }
            }
          }

          if (circuits.length > 0) {
            return circuits;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If we can't find circuit data, return empty array
    return [];
  } catch (error) {
    console.warn('Could not extract circuit data:', error.message);
    return [];
  }
}

async function extractPowerFromChart(page) {
  // Attempt to extract power data from SVG/canvas charts
  // This is a fallback when direct text extraction fails
  try {
    // Look for chart elements that might contain power data
    const chartSelectors = [
      'svg',
      'canvas',
      '.chart',
      '[class*="chart"]'
    ];

    for (const selector of chartSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          // Try to get tooltip or data attributes
          const title = await element.getAttribute('title');
          const ariaLabel = await element.getAttribute('aria-label');

          if (title || ariaLabel) {
            const text = title || ariaLabel;
            const match = text.match(/([\d,]+\.?\d*)\s*kW/i);
            if (match) {
              return parseFloat(match[1].replace(/,/g, ''));
            }
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    return null;
  } catch (error) {
    console.warn('Could not extract power from chart:', error.message);
    return null;
  }
}

async function saveData(data) {
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Save latest data
  const latestFile = path.join(dataDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(data, null, 2));

  // Append to historical data
  const historicalFile = path.join(dataDir, 'historical.json');
  let historical = [];

  if (fs.existsSync(historicalFile)) {
    try {
      historical = JSON.parse(fs.readFileSync(historicalFile, 'utf8'));
      if (!Array.isArray(historical)) {
        historical = [];
      }
    } catch (e) {
      console.warn('Could not parse historical data, starting fresh');
      historical = [];
    }
  }

  historical.push(data);

  // Keep only last 30 days of data to prevent repo from growing too large
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  historical = historical.filter(item =>
    new Date(item.timestamp) >= thirtyDaysAgo
  );

  fs.writeFileSync(historicalFile, JSON.stringify(historical, null, 2));

  console.log(`Data saved: ${historical.length} historical records`);
}

async function checkForAnomalies(data) {
  // Check for missing hot water circuit draw pattern
  const now = new Date();
  const hours = now.getHours();

  // Define expected hot water operation hours (10am-2pm)
  const hotWaterStartHour = 10;
  const hotWaterEndHour = 14; // 2pm

  // Only check during expected hot water hours on weekdays
  const isHotWaterTime = hours >= hotWaterStartHour && hours < hotWaterEndHour;
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5; // Monday-Friday

  if (isHotWaterTime && isWeekday) {
    // Look for a circuit that might be the hot water heater
    // This is approximate - in reality, you'd need to identify the specific circuit
    const hotWaterCircuit = data.circuits.find(circuit =>
      circuit.name.toLowerCase().includes('hot') ||
      circuit.name.toLowerCase().includes('water') ||
      circuit.name.toLowerCase().includes('heater')
    );

    // If we found a potential hot water circuit, check if it's drawing expected power
    if (hotWaterCircuit) {
      const expectedPower = 3.0; // kW
      const tolerance = 0.5; // kW tolerance

      if (hotWaterCircuit.power < (expectedPower - tolerance)) {
        console.log(`ALERT: Hot water circuit drawing only ${hotWaterCircuit.power}kW (expected ~${expectedPower}kW)`);
        await createAnomalyIssue('low-hot-water-draw', {
          circuit: hotWaterCircuit.name,
          actualPower: hotWaterCircuit.power,
          expectedPower: expectedPower,
          timestamp: data.timestamp
        });
      }
    } else {
      // If we can't identify specific circuits, check overall consumption pattern
      // During hot water hours, we expect some baseline consumption
      if (data.currentPower < 0.5) { // Less than 500W - suspiciously low
        console.log(`ALERT: Overall power consumption suspiciously low during hot water hours: ${data.currentPower}kW`);
        await createAnomalyIssue('low-consumption-during-hot-water-hours', {
          power: data.currentPower,
          timestamp: data.timestamp
        });
      }
    }
  }
}

async function createAnomalyIssue(type, details) {
  try {
    // Use GitHub CLI to create an issue
    const { execSync } = require('child_process');

    let title, body;

    switch (type) {
      case 'low-hot-water-draw':
        title = `���🚨 Low Hot Water Circuit Draw Detected`;
        body = `## SolarEdge Monitoring Alert

**Time**: ${new Date(details.timestamp).toLocaleString()}
**Circuit**: ${details.circuit}
**Actual Power**: ${details.actualPower.toFixed(2)} kW
**Expected Power**: ~${details.expectedPower.toFixed(2)} kW
**Issue**: Hot water circuit is drawing significantly less power than expected during operational hours (10am-2pm).

This could indicate:
- Hot water heater malfunction
- Electrical issue with hot water circuit
- Timing or control system problem

Please investigate to avoid potential emergency service calls.
`;
        break;

      case 'low-consumption-during-hot-water-hours':
        title = `���🚨 Low Power Consumption During Hot Water Hours`;
        body = `## SolarEdge Monitoring Alert

**Time**: ${new Date(details.timestamp).toLocaleString()}
**Current Power**: ${details.power.toFixed(2)} kW
**Issue**: Overall power consumption is unusually low during expected hot water heater operation hours (10am-2pm on weekdays).

This suggests the hot water heater may not be operating as expected.
Please check the hot water system and electrical circuit.
`;
        break;

      default:
        title = `���🚨 SolarEdge Monitoring Anomaly`;
        body = `## SolarEdge Monitoring Alert

**Time**: ${new Date(details.timestamp).toLocaleString()}
**Type**: ${type}
**Details**: ${JSON.stringify(details, null, 2)}

Please review the SolarEdge monitoring data for anomalies.
`;
    }

    // Use gh issue create command
    execSync(`gh issue create --title "${title}" --body '${body}' --label "monitoring,alert"`);
    console.log(`Created GitHub issue for anomaly: ${type}`);

  } catch (error) {
    console.error('Failed to create GitHub issue:', error.message);
  }
}

async function createMonitoringIssue(error) {
  try {
    const { execSync } = require('child_process');

    const title = `���💥 SolarEdge Monitoring System Error`;
    const body = `## SolarEdge Monitoring System Failure

**Time**: ${new Date().toLocaleString()}
**Error**: ${error.message}
**Stack**: ${error.stack}

The automated monitoring system encountered an error and could not complete its data collection cycle.

Please check:
- GitHub Actions logs for detailed error information
- SolarEdge website accessibility and any UI changes
- Credential validity in repository secrets
`;

    execSync(`gh issue create --title "${title}" --body '${body}' --label "monitoring,error"`);
    console.log('Created GitHub issue for monitoring error');

  } catch (err) {
    console.error('Failed to create monitoring error issue:', err.message);
  }
}

// Run the monitoring function
monitorSolarEdge().catch(console.error);
