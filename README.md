# Control Station

The control station repository of the Self-Charging Autonomous Drone System with Fleet Scheduling project.

# 1. Responsibles and Contributors

| Name | Student ID |
|---|---|
| Sem Axil Rais | 40113324 |
| Zaree Choudhry Hameed | 21026488 |

# 2. Purpose

## Context

This drone project consists of 5 (simulated) + 1 (physical) drones that needs to be able to fly autonomously to undertake specific missions and return and land on a charging pad whenever it needs charging. The order and priority specifiying which drone occupie the charging pad is handled by the fleet scheduler. 

## Problem

There is a need for a mean of communication between the drones and the fleet scheduler. An operator must also be able analysis the fleet and, if needed, to remotely send overriding commands to each drone; specifying which should go charge in priority, which should abort the mission, etc.

## Solution

A control station will be implemented to ensure communication between the operator, the drones, and the fleet scheduler. It will forward drone and charging pad telemetry to the fleet scheduler for further analysis and to help schedule charging pad allocations. A dashboard within the control station will provide a visual of the fleet state. To demonstrate the project, a VR system will be used for a mean of visualization of the simulated drones, their behavior, and their charging.

# 3. Requirements

## Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-021 | The control station SHALL receive and store information from the fleet scheduler, including scheduling decisions. |
| FR-022 | The control station SHALL receive and store information from the charging pad, including pad availability, status, and current temperature. |
| FR-023 | The control station SHALL receive and store information from each drone in the fleet, including SoC, SoH, drone velocity, altitude, and position relative to the charging pad. |
| FR-024 | The control station SHALL display collected information in a dashboard including fleet overview, live telemetry per drone, charging pad state, and scheduler decisions. |
| FR-025 | The control station SHALL collect and display logs. |
| FR-026 | The control station SHALL provide an operator interface that permits clients to send override commands. |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-008 | The control station SHALL display scheduler decisions as a Gantt chart. |
| NFR-009 | The control station SHALL handle malformed messages, communication interruptions, and errors gracefully. |
| NFR-022 | The control station SHALL display logs with the following levels:<br>* INFO<br>* WARN<br>* ERROR<br>* FATAL<br>* DEBUG |

# 4. Design

## Block Diagram

![Control Station and VR block diagram](<docs/Block Diagram - Control Station and Visualization.png>)

## Interfaces

![Control Station and VR interfaces](<docs/Interfaces - Control Station and Visualization-2.png>)

## Flowcharts

### Control Station

![Control Station flowchart](<docs/control station/Flowchart Control Station.png>)

### VR

![VR flowchart](<docs/VR/Flowchart Visualization.png>)

## UML Sequence

### Control Station

![Control Station UML sequence diagram](<docs/control station/UML Control Station - Sequence.png>)

### VR

![VR UML sequence diagram](<docs/VR/UML Visualization - Sequence.png>)

# Installation

## Installation on macOS (Terminal)

### 1. Install Node.js and Python

```sh
brew update
brew install node python
```

Verify:

```sh
node --version
npm --version
python3 --version

```

### 2. Clone the repository

### 3. Install and run

```sh
cd control_station
npm run setup
npm run dev
```

## Installation on Windows (PowerShell)

### 1. Install Node.js and Python

```powershell
winget install --id OpenJS.NodeJS --exact --source winget
winget install --id Python.PythonInstallManager --exact --source winget
```

Close and reopen the terminal after installation.

```powershell
pymanager install
node --version
npm.cmd --version
py -3 --version
```

Close and reopen the terminal after installation.

### 2. Clone the repository

### 3. Install and run

```powershell
cd control_station
npm.cmd run setup
npm.cmd run dev
```

## Running

```sh
npm run dev
```
And

```powershell
npm.cmd run dev
```
Runs both servers at the same time.

If you need only the frontend or backend server to run, use:

- `npm run dev:frontend`: frontend only.
- `npm run dev:backend`: backend only.
- `npm.cmd run dev:frontend`: frontend only. (Windows)
- `npm.cmd run dev:backend`: backend only. (Windows)

### Local URLs

After starting the servers, use these links:

| Purpose | URL | What you should see |
|---|---|---|
| Control Station application | [http://127.0.0.1:5173/](http://127.0.0.1:5173/) | The Control Station application |
| Backend API documentation | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive documentation for the API endpoints. |
| The backend base URL | [http://127.0.0.1:8000/](http://127.0.0.1:8000/) | Empty for now |

### Closing both servers

Press Ctrl+C to stop both servers.
