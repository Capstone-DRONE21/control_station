# Polyrepo Strategy

				Organization Name (We should choose a team name)
									|
									|
									|
			___________________________________________________________________________
			|			|			|			  |					|				  |
			|			|			|			  |					|				  |
	Flight Control     BMS   Charging Pad   Fleet Scheduler  Control Station	Documentation?
			

# Documentation Repository

We could add a repositories exclusively for documentation

It would contain:
	- README.md file
	- Requirements folder
	- Architecture folder for each subsystem
	- Interfaces
	- Backlog folder for each subsystem
	- Diagrams
	
THIS REPOSITORY IS OPTIONAL, WE CAN KEEP EVERYTHING ON THE DRIVE ALSO


# Naming and folder organization convention:

-Use clear folder names
-Every repo should contain its README.md explaining:
		- Responsibles
		- Overview
		- Setup Instructions
		- Running Instructions
		
-Every repo should contain a .gitignore file where they include what files shouldn't be included in their repositories (.DS_Store, .env, .vscode/, etc)
		
# Branching Strategy:

I suggest a GitFlow + Feature Branching Strategy:
	- One main/master branch that we merge with development once it is stable and ready to ship
		- Stable
		- Tested
		- No conflicts/Integration verified
	- One development branch that we merge with feature/tasks branches once they are completed
	- Feature/tasks branches
	
Name your branch as clearly as possible!
-Ex: feature/<feature_name>

# Commits Conventions:

feat: elaborate
fix: elaborate
test: elaborate
docs: elaborate
refactor: elaborate

Keep simple, concise and short commit messages

# Pull Requests

- Use pull requests
- Ask for a reviewer whenever possible
- CI/CD checks if time permits

# GitHub Issues

Convert tasks into GitHub issues
	- Easy to track progress and TODOs
	- We can connect all issues into one project
	
# GitHub Actions

- Automate build processes
- Automate tests (if time permits)
