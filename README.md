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

# 5. Alternatives Analysis

## 5.1 Control Station Architecture

### Alternative A - Centralized control station

The control station receive the information from the drones, charging pad and fleet scheduler.The operator can monitor the commands from one place which makes easier to login and trace the commands. However, if the control station doesn't work then the communication and fleet scheduler would be interrupted.

### Alternative B - Direct communication between subsystems

The drones will directly communicating with other subsystem like charging pad and
scheduler and also with each other.The control station directly shows their information and allows the operator to send commands. Even though the control station is unavailable but it let some activities to continue. However, there are other rules needed for managing the connections when operator commands have conflicted with scheduler decisions.

### Weighted Evaluation

| Criterion | Weight | Centralized Control Station | Direct Communication Between Subsystems |
| --- | ---: | ---: | ---: |
| Command authority and state consistency | 25% | 9 | 6 |
| Continuity during control-station failure | 25% | 3 | 8 |
| Implementation effort | 20% | 8 | 5 |
| Logging traceability | 15% | 9 | 5 |
| Integration simplicity | 10% | 8 | 5 |
| Ability to accommodate growth | 5% | 6 | 7 |
| **Weighted Score / 10** | **100%** | **7.05** | **6.10** |

## 5.2 Operator Interface

### Alternative A - Custom web dashboard

The dashboard specifically designed to show the with battery indicators, a charging schedule and override buttons.The operator uses the dashboard to view drone information, charging-pad status and scheduling decisions.We used the React/typescript for frontend and FastAPI/python for backend. However, we still need to develop and test the live updates, connection warnings and command feedback.

### Alternative B - Native Desktop Application

A desktop application that provides a monitoring dashboard and command controls. It can integrate with local device interfaces which helps when the station connects to physical hardware. It requires the support of multiple operating systems at the same time which makes the implementation more lengthy and difficult.

### Alternative C - Adapt an Existing Ground-Control Application

This alternative extends an existing drone-control application. This application may offer telemetry displays, commands and overall monitoring which reduce significantly the implementation effort. It needs to be compatible with the physical drone, simulated drones and the interfaces used. For charging pad information and scheduler integration. it may require customization that is beyond the application's functions. 

### Weighted Evaluation

| Criterion | Weight | Custom Web Dashboard | Native Desktop Application | Adapt an Existing Ground-Control Application |
| --- | ---: | ---: | ---: | ---: |
| Fit with monitoring and controls | 25% | 9 | 9 | 5 |
| Compatibility with subsystems interfaces | 20% | 8 | 8 | 5 |
| Implementation effort | 20% | 8 | 5 | 6 |
| Deployment across macOS and Windows | 15% | 9 | 5 | 6 |
| Flexibility  | 10% | 9 | 8 | 5 |
| Accessto local hardware | 10% | 4 | 9 | 8 |
| **Weighted Score / 10** | **100%** | **8.10** | **7.30** | **5.65** |

## 5.3 Data Exchange

### Alternative A - Periodic Polling

The dashboard requests the latest telemetry at fixed intervals and the receiving service responds with its current information. Information remain outdated until the next request but shorter polling intervals reduce that delay, however, it increases traffic.

### Alternative B - Persistent Connection

A perisstent connection allows a service to send updates as they become available instead of waiting for continuous requests from the receiver. It supports frequent and realtime updates but require handling disconnetions, reconnections and synchronization.

### Alternative C - Broker-Based Messaging

Subsystems publish messages to a broker, and "interested" consumers subscribe to them (ie.: telemetry, charging-pad status, scheduling decisions or command channels). Producers do not need a direct connection to every consumer. However, the broker needs to be configured, ran, monitored and be recovered if for any reason it fails.

### Weighted Evaluation

| Criterion | Weight | Periodic Polling | Persistent Connections | Broker-Based Messaging |
| --- | ---: | ---: | ---: | ---: |
| Telemetry freshness | 25% | 4 | 10 | 10 |
| Command feedback and recovery | 25% | 6 | 8 | 8 |
| Implementation effort | 20% | 10 | 8 | 4 |
| Integration across subsystems | 15% | 6 | 6 | 10 |
| Operational simplicity | 10% | 10 | 8 | 4 |
| Ability to accommodate growth | 5% | 4 | 8 | 10 |
| **Weighted Score / 10** | **100%** | **6.60** | **8.20** | **7.70** |

## 5.4 Visualization

### Alternative A - 2D Dashboard or Map

Using the dashboard and using 2D elements or map to visualize the fleet such as the camera broadcast on the drones, a map showing the live position of all drones relative to the charging pad, along with their telemetry. It provides less spatial understanding of the drones.

### Alternative B - Interactive 3D Scene

A 3D scene using Three.js represents the environment, drones and charging pad from a camera pov that the user cn move. It can image flight paths, altitude differences and landing sequences. This alternative supports desktop demonstration.

### Alternative C - Immersive VR

An immersive VR interface presents the fleet environment with a metaquest headset, which allows the user to view drone activity from a spatial perspective. It helps demonstrate autonomous movements, landing and all drones flying together. It allows for telemtry reading by selecting a drone and is more suitable for a good demonstration.

### Weighted Evaluation

| Criterion | Weight | 2D Dashboard or Map | Interactive 3D Scene | Immersive VR |
| --- | ---: | ---: | ---: | ---: |
| Demonstration relevance | 25% | 2 | 4 | 10 |
| Understanding spatial behavior | 20% | 4 | 8 | 10 |
| Clarity for fleet monitoring | 20% | 10 | 6 | 6 |
| Implementation effort | 15% | 8 | 8 | 4 |
| Hardware accessibility | 10% | 10 | 8 | 10 |
| Ease of demonstration | 10% | 10 | 8 | 4 |
| **Weighted Score / 10** | **100%** | **6.50** | **6.60** | **7.70** |

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
