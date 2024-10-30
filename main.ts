import { HoverPopover, MarkdownRenderer, Plugin, TFile, moment, Setting, App, PluginSettingTab, ColorComponent} from "obsidian";

export default class ActivityTracker extends Plugin {
	settings: ActivityTrackerSettings;

	async onload() {
		this.app.workspace.onLayoutReady( async () => {
			//create settings tab
			await this.loadSettings();
			this.addSettingTab(new ActivityTrackerTab(this.app, this));

			//find the file that contains the data
			let files = this.app.vault.getMarkdownFiles();
			let mondayFileName = moment().startOf('isoWeek').format("YYYY-MM-DD").toString()+".md";
			let mondayFile = files.find((x: { name: string; }) => x.name == mondayFileName);

			//if the file exists
			if (mondayFile) {
				//create an activity button for each activity in the settings tab
				this.settings.activities.forEach(async (a) => {
					await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, mondayFile);
				})
			}
		});
	}

	async createActivity(metadataValue : string, emoji : string, maxValue : number, startColor : string, endColor : string, mondayFile : TFile) {
		//create status bar element
		let statusBarButton = this.addStatusBarItem().createEl('button');

		//when the button is left clicked
		statusBarButton.addEventListener('click', async () => {	
			//get the value from the file's frontmatter
			let value = await this.GetValue(metadataValue, mondayFile);

			//if the button is already open
			if (statusBarButton.hasClass("active")) {
				//close it
				generateButtonTextNoBoxes(value);
				statusBarButton.removeClass("active")
			}
			//if the button is closed
			else {
				//open it
				generateButtonText(value);
				statusBarButton.addClass("active")
			}
		});		

		//when the button is right clicked
		statusBarButton.addEventListener('contextmenu', async () => {	
			//get the value from the file's frontmatter
			let value = await this.GetValue(metadataValue, mondayFile);

			//if the button isnt open
			if (!statusBarButton.hasClass("active")) {
				return;
			}

			//if the metadata doesnt exist
			if (await (this.GetValue(metadataValue, mondayFile)) == "") {
				return
			}

			//add 1 to the value
			value = `${parseInt(value) + 1}`;
			generateButtonText(value);

			//update the frontmatter with the new value
			this.app.vault.process(mondayFile, (fileData) => {
				return fileData.replace(`${metadataValue}: ${parseInt(value)-1}`, `${metadataValue}: ${parseInt(value)}`);
			});

			//same thing but incase the fronmatter is empty
			this.app.vault.process(mondayFile, (fileData) => {
				return fileData.replace(`${metadataValue}: \n`, `${metadataValue}: ${parseInt(value)}\n`);
			});
		});		
			
		//displaying the button when it is open
		let generateButtonText = async (textValue : string) => {		
			//if the metadata doesnt exist 
			if (await (this.GetValue(metadataValue, mondayFile)) == "") {
				statusBarButton.setText(emoji+`ERROR : ${metadataValue} does not exist in this weeks monday file. Please add it to the file's properties`);
				setCSS(false);
				return;
			}

			//add the emoji and the current/max text
			statusBarButton.setText(emoji+`${textValue}/${maxValue} `);
			setCSS(true);

			//add maxValue boxes, filled in if that point has been gained, empty if not
			for(let i = 1; i <= maxValue; i = i+1){
				if (i <= parseInt(textValue)) {
					statusBarButton.textContent += `▮`;
				}
				else {
					statusBarButton.textContent += "▯";
				}
			}
		}

		//displaying the button when it is closed
		let generateButtonTextNoBoxes = (textValue : string) => {		
			//add the emoji and the current/max
			statusBarButton.setText(emoji+`${textValue}/${maxValue} `);	
			
			//if the goal has been reached, display in color, otherwise in gray
			if (parseInt(textValue) >= maxValue) {
				setCSS(true);
			}
			else {
				setCSS(false);
			}
		}

		//setting the style of the button
		let setCSS = async (color : boolean) => {
			//if the metadata value doesnt exist, display in red
			if (await (this.GetValue(metadataValue, mondayFile)) == "") {
				statusBarButton.style.setProperty('background', "#FF0000");
			}
			//display in color
			else if (color){
				statusBarButton.style.setProperty('background', `linear-gradient(to right, ${startColor} 0%, ${endColor} 100%)`);
			} 
			//display in gray
			else {
				statusBarButton.style.setProperty('background', "#949494");
			}

			//set all the other styles
			statusBarButton.style.setProperty('-webkit-background-clip', 'text');
			statusBarButton.style.setProperty('background-clip', 'text');
			statusBarButton.style.setProperty('-webkit-text-fill-color', 'transparent');
			statusBarButton.style.setProperty('overflow', 'hidden');
		}		
		
		//initial display upon loading
		generateButtonTextNoBoxes(await this.GetValue(metadataValue, mondayFile));
	}

	//used to get the value from the frontmatter
	async GetValue(metadataValue : string, mondayFile : TFile) : Promise<string> {
		//read all the data from the file
		let fileData = await this.app.vault.read(mondayFile);

		//split the file into an array of lines
		let  fileDataArray = fileData.split('\n');

		let value = "";
		//foreach line in the file
		fileDataArray.forEach(line => {
			//if the line contains the desired value
			if (line.contains(metadataValue)) {

				//sepeate the value from the key
				let keyAndValue = line.split(':');
	
				//read from the key and value pair
				value = keyAndValue[1].toString();

				//if value is blank, insert a 0
				if (value==" ") {
					value = " 0";
				}
			}
		});

		return value;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class Activity {
	name : string;
	emoji : string;
	max : string;
	startColor : string;
	endColor : string;

	constructor(name: string, emoji : string, max: string, startColor: string, endColor: string) {
		this.name = name;
		this.emoji = emoji;
		this.max = max;
		this.startColor = startColor;
		this.endColor = endColor;
	}
}

interface ActivityTrackerSettings {
	activities : Array<Activity>;
}

const DEFAULT_SETTINGS: Partial<ActivityTrackerSettings> = {
	activities: [new Activity("","","","","")],
}

export class ActivityTrackerTab extends PluginSettingTab {
	plugin: ActivityTracker;
  
	constructor(app: App, plugin: ActivityTracker) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
  
	display(): void {
		let { containerEl } = this;
  
	  	containerEl.empty();
	  	containerEl.createEl("p", { text: `NOTE Changes are not applied until reload` });

	  	this.plugin.settings.activities.map((activity, index) => {
			new Setting(containerEl)
      			.setName('Frontmatter value')
      			.setDesc("Value in the file's frontmatter")
      			.addText((text) =>
        		text
          			.setPlaceholder('Frontmatter value')
          			.setValue(activity.name)
          			.onChange(async (value) => {
          	  			activity.name = value;
          	  			await this.plugin.saveSettings();
         	 		})
      			);		
	
			new Setting(containerEl)
				.setName('Icon')
				.setDesc('Icon used for the status bar button')
				.addText((text) =>
				text
					.setPlaceholder('☺')
					.setValue(activity.emoji)
			  		.onChange(async (value) => {
						activity.emoji = value;
						await this.plugin.saveSettings();
			  		})
				);		

			new Setting(containerEl)
				.setName('Goal')
				.setDesc('Weekly goal for this activity')
				.addText((text) =>
				text
					.setPlaceholder('10')
					.setValue(activity.max)
			  		.onChange(async (value) => {
						activity.max = value;
						await this.plugin.saveSettings();
			  		})
				);	

			new Setting(containerEl)
				.setName('Start color')
				.setDesc('Starting color for the status bar gradient')
				.addColorPicker((color) =>
				color
					.setValue(activity.startColor)
			  		.onChange(async (value) => {
						activity.startColor = value;
						await this.plugin.saveSettings();
			  		})
				);

			new Setting(containerEl)
				.setName('End color')
				.setDesc('Ending color for the status bar gradient')
				.addColorPicker((color) =>
				color
					.setValue(activity.endColor)
			  		.onChange(async (value) => {
						activity.endColor = value;
						await this.plugin.saveSettings();
			 		 })
				);

			new Setting(containerEl).addButton((el) =>
				el.setButtonText("Remove activity").onClick(() => {		  
			 		delete this.plugin.settings.activities[index];
			  		this.display();
				}),
			);
		});

		new Setting(containerEl).addButton((el) =>
			el.setButtonText("Add new activity").onClick(() => {
				let newActivity = {
					name: "",
					emoji: "",
					max: "",
					startColor: "",
					endColor: "",
		  		};

		  		this.plugin.settings.activities.push(newActivity);
		  		this.display();
			}),
		);
	}
}