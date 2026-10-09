# Control Station

The control station repository of the Self-Charging Autonomous Drone System with Fleet Scheduling project.

# Responsibles and Contributors

| Name | Student ID |
|---|---|
| Sem Axil Rais | 40113324 |
| Zaree Choudhry Hameed | 21026488 |

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
