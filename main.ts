import { HoverPopover, MarkdownRenderer, Plugin, TFile, moment, Setting, App, PluginSettingTab, ColorComponent, MetadataCache} from "obsidian";
import { createDailyNote, getDailyNoteSettings } from 'obsidian-daily-notes-interface';

export default class ActivityTracker extends Plugin {
	settings: ActivityTrackerSettings;
	activityButtons: any[];
	statusBarItem: HTMLElement;

	async onload() {
		this.app.workspace.onLayoutReady( async () => {
			this.activityButtons = [];
			this.statusBarItem = this.addStatusBarItem();

			//create settings tab
			await this.loadSettings();
			this.addSettingTab(new ActivityTrackerTab(this.app, this));

			this.createActivities();
		});
	}

	async createActivities() {
		//find the file that contains the data
		const format = getDailyNoteSettings().format;
		let mondayFileName = moment().startOf('isoWeek').format(format).toString()+".md";
		let mondayFile = this.app.metadataCache.getFirstLinkpathDest(mondayFileName, "/");

		//if the file exists
		if (mondayFile) {
			//create an activity button for each activity in the settings tab
			this.settings.activities.forEach(async (a) => {
				await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, mondayFile);
			})
		}
	}

	async resetActivites() {
		this.activityButtons.forEach(element => {
			element.remove();
		})

		this.activityButtons = [];
		this.statusBarItem.remove();
		this.statusBarItem = this.addStatusBarItem();
		this.createActivities();
	}

	async createActivity(metadataValue : string, emoji : string, maxValue : number, startColor : string, endColor : string, mondayFile : TFile) {
		//create status bar element
		let statusBarButton = this.statusBarItem.createEl('button');
		this.activityButtons.push(statusBarButton);
		statusBarButton.addClass("statusBarButton");

		//when the button is left clicked
		statusBarButton.addEventListener('click', async () => {	
			//get the value from the file's frontmatter
			let value = await this.GetValue(metadataValue, mondayFile, true);

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
		statusBarButton.addEventListener('contextmenu', async (e) => {	
			//get the value from the file's frontmatter
			let value = await this.GetValue(metadataValue, mondayFile, false);

			//if the button isnt open
			if (!statusBarButton.hasClass("active")) {
				return;
			}

			//change value
			let int = e.shiftKey ? -1 : 1;

			value = `${parseInt(value) + int}`;
			generateButtonText(value);

			this.app.fileManager.processFrontMatter(mondayFile, (frontmatter) => {
				console.log(parseInt(value))
				frontmatter[metadataValue] = parseInt(value);
			});
		});		
			
		//displaying the button when it is open
		let generateButtonText = async (textValue : string) => {		
			//add the emoji and the current/max text
			statusBarButton.setText(emoji+`${textValue}/${maxValue} `);
			setCSS(true);

			let loopValue = parseInt(textValue)>maxValue ? parseInt(textValue) : maxValue

			//add maxValue boxes, filled in if that point has been gained, empty if not
			for(let i = 1; i <= loopValue; i = i+1){
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
			statusBarButton.setText(emoji+(this.settings.hideWhenClosed?``:`${textValue}/${maxValue} `));	
			
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
			//display in color
			if (color){
				statusBarButton.style.setProperty('background', `linear-gradient(to right, ${startColor} 0%, ${endColor} 100%)`);
			} 
			//display in gray
			else {
				statusBarButton.style.setProperty('background', "var(--text-faint)");
			}

			//set all the other styles
			statusBarButton.style.setProperty('-webkit-background-clip', 'text');
			statusBarButton.style.setProperty('background-clip', 'text');
			statusBarButton.style.setProperty('-webkit-text-fill-color', 'transparent');
			statusBarButton.style.setProperty('overflow', 'hidden');
		}		
		
		//initial display upon loading
		generateButtonTextNoBoxes(await this.GetValue(metadataValue, mondayFile, false));
	}

	//used to get the value from the frontmatter
	async GetValue(metadataValue : string, mondayFile : TFile, addFrontmatter : boolean) : Promise<string> {
		let data = "0";
		data = this.app.metadataCache.getCache(mondayFile.path)?.frontmatter?.[metadataValue];

		if (data == undefined || data == null) {
			if (addFrontmatter) {
				this.app.fileManager.processFrontMatter(mondayFile, (frontmatter) => {
					frontmatter[metadataValue] = 0;
				});
			}
			data = "0";
		}

		return data;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		this.resetActivites();
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
	hideWhenClosed : boolean;
}

const DEFAULT_SETTINGS: Partial<ActivityTrackerSettings> = {
	activities: [new Activity("","","","","")],
	hideWhenClosed: false,
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

		new Setting(containerEl)
			.setName('Hide numbers when button is closed?')
		  	.addToggle((toggle) =>
			toggle
			  	.setValue(this.plugin.settings.hideWhenClosed)
			  	.onChange(async (value) => {
					this.plugin.settings.hideWhenClosed = value;
					await this.plugin.saveSettings();
			  })
		  );		

		new Setting(containerEl)
			.setName('Activities')
			.setHeading()
		
	  	this.plugin.settings.activities.map((activity, index) => {
			new Setting(containerEl)
      			.setName('Frontmatter value')
      			.setDesc("Value in the file's frontmatter. NOTE - changing this will not update the name in the frontmatter and instead just create a new property")
      			.addText((text) =>
        		text
          			.setPlaceholder('Insert name here')
          			.setValue(activity.name)
          			.onChange(async (value) => {
          	  			activity.name = value;
          	  			await this.plugin.saveSettings();
         	 		})
      			);		
	
			new Setting(containerEl)
				.setName('Icon')
				.setDesc('Icon used for the status bar button. I recommend using https://emojipedia.org/ to find icons')
				.addText((text) =>
				text
					.setPlaceholder('Paste emoji here')
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
					.setPlaceholder('Insert goal here')
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
			 		this.plugin.settings.activities.splice(index,1);
			  		this.display();
					this.plugin.saveSettings();
				}),
			);

			if (index != 0) {
				new Setting(containerEl).addButton((el) =>
					el.setButtonText("ʌ").onClick(() => {	
						let temp = 	this.plugin.settings.activities[index];
						this.plugin.settings.activities[index] = this.plugin.settings.activities[index-1];
						this.plugin.settings.activities[index-1] = temp;

			  			this.display();
						this.plugin.saveSettings();
					}),
				);
			}

			if (index != this.plugin.settings.activities.length-1) {
				new Setting(containerEl).addButton((el) =>
					el.setButtonText("v").onClick(() => {	
						let temp = 	this.plugin.settings.activities[index];
						this.plugin.settings.activities[index] = this.plugin.settings.activities[index+1];
						this.plugin.settings.activities[index+1] = temp;

			  			this.display();
						this.plugin.saveSettings();
					}),
				);
			}
		});

		new Setting(containerEl).addButton((el) =>
			el.setButtonText("Add new activity").onClick(() => {
				let newActivity = {
					name: "",
					emoji: "",
					max: "",
					startColor: "",
					endColor: " ",
		  		};

		  		this.plugin.settings.activities.push(newActivity);
		  		this.display();
				this.plugin.saveSettings();
			}),
		);
	}
}