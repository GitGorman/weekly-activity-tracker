import { HoverPopover, MarkdownRenderer, Plugin, TFile, moment} from "obsidian";

export default class ActivityTracker extends Plugin {
	async onload() {
		this.app.workspace.onLayoutReady( async () => {
			//find the file that contains the data
			let files = this.app.vault.getMarkdownFiles();
			let mondayFileName = moment().startOf('isoWeek').format("YYYY-MM-DD").toString()+".md";
			let mondayFile = files.find((x: { name: string; }) => x.name == mondayFileName);

			if (mondayFile) {
				await this.createActivity("run_value","👟", "runbutton" , 6 , mondayFile);
				await this.createActivity("cycle_value","🚲", "cyclebutton" , 6 , mondayFile);
				await this.createActivity("yoga_value","🧘", "yogabutton" , 7 , mondayFile);
				await this.createActivity("workout_value","💪", "workoutbutton" , 5 , mondayFile);
				await this.createActivity("study_value","🎓", "studybutton" , 30 , mondayFile);
				await this.createActivity("project_value","🎮", "projectbutton" , 10 , mondayFile);
				await this.createActivity("maintenance_value","🧹", "maintenancebutton" , 10 , mondayFile);
				await this.createActivity("hydration_value","💧", "hydrationbutton" , 35 , mondayFile);
				await this.createActivity("eating_value","🍎", "eatingbutton" , 35 , mondayFile);
				await this.createActivity("giving_value","🎁", "givingbutton" , 20 , mondayFile);
				await this.createActivity("knowledge_value","📚", "knowledgebutton" , 7 , mondayFile);
			}
		});
	}

	async createActivity(metadataValue : string, emoji : string, buttonClass : string, maxValue : number, mondayFile : TFile) {
		//create status bar element
		let statusBarButton = this.addStatusBarItem().createEl('button');
		statusBarButton.addClass(buttonClass);			
		//read all the data from the file
		var fileData = await this.app.vault.read(mondayFile);
		let value = "";
			
		let generateButtonText = (textValue : string) => {		
			statusBarButton.setText(emoji);
			for(let i = 1; i <= maxValue; i = i+1){
				if (i <= parseInt(textValue)) {
					statusBarButton.textContent += `▮`;
				}
				else {
					statusBarButton.textContent += "▯";
				}
			}
		}

		let generateButtonTextNoBoxes = () => {		
			statusBarButton.setText(emoji);		
		}

		//find the line that contains the desired data
		var fileDataArray = fileData.split('\n');
		fileDataArray.forEach(line => {
			if (line.contains(metadataValue)) {
				//sepeate the value from the key
				let keyAndValue = line.split(':');
				
				//read from the key and value pair
				value = keyAndValue[1].toString();

				//write the value to the status bar element
				generateButtonTextNoBoxes();
			}
		});
						
		statusBarButton.addEventListener('click', () => {	
			if (statusBarButton.hasClass("active")) {
				generateButtonTextNoBoxes();
				statusBarButton.removeClass("active")
			}
			else {
				generateButtonText(value);
				statusBarButton.addClass("active")
			}
		});		

		statusBarButton.addEventListener('contextmenu', () => {	
			if (!statusBarButton.hasClass("active"))
				return;

			if (parseInt(value) < maxValue) {
				value = `${parseInt(value) + 1}`;
				generateButtonText(value);

				this.app.vault.process(mondayFile, (fileData) => {
					return fileData.replace(`${metadataValue}: ${parseInt(value)-1}`, `${metadataValue}: ${parseInt(value)}`);
				});
			}
		});						
	}
}