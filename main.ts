import { Plugin, TFile, moment, Setting, App, PluginSettingTab, Notice, TAbstractFile, Editor, Menu, Modal} from "obsidian";
import { getDailyNoteSettings, getWeeklyNoteSettings } from 'obsidian-daily-notes-interface';

export default class ActivityTracker extends Plugin {
	settings: ActivityTrackerSettings;
	activityButtons: any[];
	weeklyStatusBarItem: HTMLElement;
	dailyStatusBarItem: HTMLElement;
	weekFileName: string;
	mondayFileName: string;
	todayFileName:string
	notice : Notice;
	mouseX : number;
	mouseY : number
	requireDay : boolean;
	requireWeek : boolean;

	async onload() {
		this.app.workspace.onLayoutReady( async () => {
			this.activityButtons = [];
			this.weeklyStatusBarItem = this.addStatusBarItem();
			this.dailyStatusBarItem = this.addStatusBarItem();

			this.weeklyStatusBarItem.addClass('container');
			this.dailyStatusBarItem.addClass('container');
			
			//create settings tab
			await this.loadSettings();
			this.addSettingTab(new ActivityTrackerTab(this.app, this));

			this.createActivities();

			//when a file is created
			this.app.vault.on('create', async () => {
				this.resetActivites();
			});

			//when a file is deleted
			this.app.vault.on('delete', async () => {
				this.resetActivites();
			});

			//when a file is renamed
			this.app.vault.on('rename', async () => {
				this.resetActivites();
			});
			
			//when file is edited
			this.app.vault.on('modify', async (file) => {
				this.tryUpdateActivityValue(file);
			})

			this.addCommand({
				id: `wgt-start`,
				name: `Attach task to goal`,
				repeatable: false,
				editorCallback: ( editor:Editor) => {
					let x = this.mouseX;
					let y = this.mouseY;
					const menu = new Menu();
					if (editor.getLine(editor.getCursor().line).contains('- [ ]') && !editor.getLine(editor.getCursor().line).contains('%%wgt')) {
						this.settings.activities.forEach(element => {
							menu.addItem((item) => item
								.setTitle(`${element.emoji}   Attach to ${element.name}`)
								.onClick(() => {
									if (!this.settings.askForWeight) {
										editor.setLine(editor.getCursor().line,editor.getLine(editor.getCursor().line)+`%%wgt[${element.name}]{1}wgt%%`);
									}
									else {
										new InputModal(this.app, (result) => {
											editor.setLine(editor.getCursor().line,editor.getLine(editor.getCursor().line)+`%%wgt[${element.name}]{${result}}wgt%%`);	
										}).open();
									}
								})
							);
						});
					} 
					else if (editor.getLine(editor.getCursor().line).contains('%%wgt')) {			
						menu.addItem((item) => item
							.setTitle(`This task is already attached to a goal. To unattach the task, remove the %%wgt[...]{...}wgt%%`)
						)
					}
					else {		
						menu.addItem((item) => item
							.setTitle(`Please make sure there is an unchecked task on the current line before attempting to attach it to a goal`))	
					}
					menu.showAtPosition({ x: x, y: y});
				}
			});
		});

		//use to get the postion of the mouse for the command menu
		document.onmousemove = (event) => {
			this.mouseX = event.clientX;
			this.mouseY = event.clientY;
		}
	}

	async createActivities() {
		//find the file that contains the data
		const weekFormat = getWeeklyNoteSettings().format;
		this.weekFileName = moment().format(weekFormat).toString()+".md";
		let weekFile = this.app.metadataCache.getFirstLinkpathDest(this.weekFileName, "/");

		const dayFormat = getDailyNoteSettings().format;
		this.mondayFileName = moment().startOf('isoWeek').format(dayFormat).toString()+".md";
		let mondayFile = this.app.metadataCache.getFirstLinkpathDest(this.mondayFileName, "/");

		this.todayFileName = moment().format(dayFormat).toString()+".md";
		let todayFile = this.app.metadataCache.getFirstLinkpathDest(this.todayFileName, "/");

		//check if neither weekly or daily are needed
		this.requireWeek = false;
		this.requireDay = false;

		this.settings.activities.forEach(element => {
			if (element.frequency == 'weekly') {
				this.requireWeek = true;
			}
			else if (element.frequency == 'daily') {
				this.requireDay = true;
			}
		});
		

		this.settings.activities.forEach(async (a) => {
			if (this.requireWeek && !this.requireDay) {
				if (this.settings.useWeekFile) {
					if (weekFile) {
						await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, weekFile, weekFile);
					}
					else {
						this.displayErrorMessage(this.weekFileName);
					}
				}
				else {
					if (mondayFile) {
						await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, mondayFile, mondayFile);
					}
					else {
						this.displayErrorMessage(this.mondayFileName);
					}
				}
			}
			else if (this.requireDay && !this.requireWeek) {
				if (todayFile) {
					await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, todayFile, todayFile);
				}
				else {
					this.displayErrorMessage(this.todayFileName);
				}
			}
			else if (this.requireDay && this.requireWeek){
				if (this.settings.useWeekFile) {
					if (weekFile && todayFile) {
						await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, weekFile, todayFile);
					}
					else {
						if (!weekFile) {
							this.displayErrorMessage(this.weekFileName);
						}
						else if (!todayFile){
							this.displayErrorMessage(this.todayFileName);
						}
					}
				}
				else {
					if (mondayFile && todayFile) {
						await this.createActivity(a.name, a.emoji, parseInt(a.max), a.startColor, a.endColor, mondayFile, todayFile);
					}
					else {
						if (!mondayFile) {
							this.displayErrorMessage(this.mondayFileName);
						}
						else if (!todayFile){
							this.displayErrorMessage(this.todayFileName);
						}
					}
				}
			} 
		})
	}

	async displayErrorMessage(fileName : string) {
		if (this.notice) {
			this.notice.hide();
		}

		let message = `WEEKLY GOAL TRACKER : File [${fileName}] not found. Please create it to start tracking goals`;

		this.notice = new Notice(message, 0);
	}

	async resetActivites() {
		this.activityButtons.forEach(element => {
			element.remove();
		});

		if (this.notice != null) {
			console.log("hide");
			this.notice.noticeEl.remove();
		}

		this.activityButtons = [];
		this.weeklyStatusBarItem.remove();
		this.weeklyStatusBarItem = this.addStatusBarItem();
		this.dailyStatusBarItem.remove();
		this.dailyStatusBarItem = this.addStatusBarItem();
		this.createActivities();
	}

	async tryUpdateActivityValue(abstractFile : TAbstractFile) {
		let thisFile = this.app.metadataCache.getFirstLinkpathDest(abstractFile.name, "/");
		let weeklyFile = this.app.metadataCache.getFirstLinkpathDest(this.settings.useWeekFile ? this.weekFileName : this.mondayFileName, "/");
		let dailyFile = this.app.metadataCache.getFirstLinkpathDest(this.todayFileName, "/");

		if (thisFile) {
			let data = this.app.vault.process(thisFile, (string) => {
				return string;
			});

			let lines = (await data).split('\n');

			lines.forEach(async (element) => {
				if ((element.contains(`- [x]`) && element.contains(`%%wgt[`) && !element.contains(`%%wgt@[`)) || (element.contains(`- [ ]`) && element.contains(`%%wgt@[`))) {
					//extract metadata value
					let metadataValue ="";
					if (element.contains(`%%wgt@[`)) {
						metadataValue = element.substring(
							element.indexOf("%%wgt@[") + 7, 
							element.indexOf("]{")
						);
					}
					else {
						metadataValue = element.substring(
							element.indexOf("%%wgt[") + 6, 
							element.indexOf("]{")
						);
					}

					let weight = parseInt(element.substring(
						element.indexOf("]{") + 2,
						element.indexOf("}wgt%%")
					));

					let chosenFile;
					if (this.getIfActivityIsDailyOrWeekly(metadataValue) == 'weekly') {
						if (weeklyFile) {
							chosenFile = weeklyFile;
						} 
						else {
							this.displayErrorMessage(this.settings.useWeekFile ? this.weekFileName : this.mondayFileName);
							return;
						}
					}
					else if (this.getIfActivityIsDailyOrWeekly(metadataValue) == 'daily') {
						if (dailyFile) {
							chosenFile = dailyFile;
						} 
						else {
							this.displayErrorMessage(this.todayFileName);
							return;
						}
					}

					if (chosenFile) {
						//get the value for that metadata
						let value = await this.getValue(metadataValue, chosenFile, false);

						//change value
						let int = element.contains(`%%wgt@[`) ? -weight : weight;
						value = `${parseInt(value) + int}`;

						this.app.fileManager.processFrontMatter(chosenFile, (frontmatter) => {
							frontmatter[metadataValue] = parseInt(value);
						})
					}

					//change the value of the line
					if (element.contains(`%%wgt@[`)) {
						let newElement = element.replace(`%%wgt@[${metadataValue}]{${weight}}wgt%%`, `%%wgt[${metadataValue}]{${weight}}wgt%%`);
						this.app.vault.process(thisFile, (data) => {
							return data.replace(element,newElement);
						});
					} 
					else {
						let newElement = element.replace(`%%wgt[${metadataValue}]{${weight}}wgt%%`, `%%wgt@[${metadataValue}]{${weight}}wgt%%`);
						console.log(newElement);
						this.app.vault.process(thisFile, (data) => {
							return data.replace(element,newElement);
						});
					}

					//used so that button doesnt end up using old value
					await new Promise(f => setTimeout(f, 500));
					this.resetActivites();

					return;
				}
			});
		}
		else {
			this.displayErrorMessage(abstractFile.name);
		}
	}

	async createActivity(metadataValue : string, emoji : string, maxValue : number, startColor : string, endColor : string, weeklyFile : TFile, dailyFile : TFile) {
		let file = this.getIfActivityIsDailyOrWeekly(metadataValue) == 'weekly' ? weeklyFile : dailyFile;
		console.log(this.getIfActivityIsDailyOrWeekly(metadataValue));

		//create status bar element
		let statusBarButton = this.getIfActivityIsDailyOrWeekly(metadataValue)=='weekly'?this.weeklyStatusBarItem.createEl('button'):this.dailyStatusBarItem.createEl('button');
		this.activityButtons.push(statusBarButton);
		statusBarButton.addClass(this.getIfActivityIsDailyOrWeekly(metadataValue)=='weekly'?"weeklyStatusBarButton":"dailyStatusBarButton");

		//when the button is left clicked
		statusBarButton.addEventListener('click', async () => {	
			//get the value from the file's frontmatter
			let value = await this.getValue(metadataValue, file, true);

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
			let value = await this.getValue(metadataValue, file, false);

			//if the button isnt open
			if (!statusBarButton.hasClass("active")) {
				return;
			}

			//change value
			let int = e.shiftKey ? -1 : 1;

			value = `${parseInt(value) + int}`;
			generateButtonText(value);

			this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[metadataValue] = parseInt(value);
			});
		});		
			
		//displaying the button when it is open
		let generateButtonText = async (textValue : string) => {		
			//add the emoji and the current/max text
			statusBarButton.setText(emoji+` `+`${textValue}/${maxValue} `);
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
			statusBarButton.setText(emoji+` `+(this.settings.hideWhenClosed?``:`${textValue}/${maxValue} `));	
			
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
		generateButtonTextNoBoxes(await this.getValue(metadataValue, file, false));
	}

	//used to get the value from the frontmatter
	async getValue(metadataValue : string, file : TFile, addFrontmatter : boolean) : Promise<string> {
		let data = "0";
		data = this.app.metadataCache.getCache(file.path)?.frontmatter?.[metadataValue];

		if (data == undefined || data == null) {
			if (addFrontmatter) {
				this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter[metadataValue] = 0;
				});
			}
			data = "0";
		}

		return data;
	}

	getIfActivityIsDailyOrWeekly(metadataValue : string) : string {
		let returnValue='';
		this.settings.activities.forEach(element => {
			if (element.name == metadataValue) {
				returnValue =  element.frequency;
				return;
			}
		});

		return returnValue;
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
	frequency : string;
	name : string;
	emoji : string;
	max : string;
	startColor : string;
	endColor : string;

	constructor(name: string, emoji : string, max: string, startColor: string, endColor: string, frequency : string) {
		this.frequency = frequency;
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
	askForWeight : boolean;
	useWeekFile : boolean;
}

const DEFAULT_SETTINGS: Partial<ActivityTrackerSettings> = {
	activities: [],
	hideWhenClosed: false,
	askForWeight: true,
	useWeekFile: false
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
		  .setName('Allow tasks to be worth multiple points?')
		  .setDesc("You will be given a prompt when attaching a task to a goal to input how many points it is worth")
			.addToggle((toggle) =>
		  toggle
				.setValue(this.plugin.settings.askForWeight)
				.onChange(async (value) => {
				  this.plugin.settings.askForWeight = value;
				  await this.plugin.saveSettings();
			})
		);	

		new Setting(containerEl)
			.setName('Monday note or weekly note for weekly goals?')
			.setDesc("Decides whether to use the monday note or the weekly note (typically in the format eg.2024-W48) to store the data for weekly goals. Daily goals are always stored in the current daily note")
			.addDropdown((dropdown) =>
			dropdown
				.addOption('monday', 'Monday file')
				.addOption('week', 'Weekly file')
				.setValue(this.plugin.settings.useWeekFile?'week':'monday')
				.onChange(async (value) => {
					this.plugin.settings.useWeekFile = (value == 'monday'?false:true);
					await this.plugin.saveSettings();
				})
		  );	

		new Setting(containerEl)
			.setName('Activities')
			.setHeading()
		
	  	this.plugin.settings.activities.map((activity, index) => {
			new Setting(containerEl)
      			.setName('Daily or weekly goal?')
      			.setDesc("Should this goal reset daily or weekly")
				.addDropdown((dropdown) =>
				dropdown
					.addOption('weekly', 'Weekly')
					.addOption('daily', 'Daily')
					.setValue(activity.frequency)
					.onChange(async (value) => {
						activity.frequency = value;
						await this.plugin.saveSettings();
				  })
				)

			new Setting(containerEl)
      			.setName('Frontmatter value')
      			.setDesc("Value in the file's frontmatter. Note changing this will not update the name in the frontmatter and instead just create a new property")
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
					frequency: 'weekly',
					name: `newgoal${this.plugin.settings.activities.length+1}`,
					emoji: "✨",
					max: "10",
					startColor: "#FFFFFF",
					endColor: "#FFFFFF",
		  		};

		  		this.plugin.settings.activities.push(newActivity);
		  		this.display();
				this.plugin.saveSettings();
			}),
		);
	}
}

export class InputModal extends Modal {
	constructor(app: App, onSubmit: (result: string) => void) {
	super(app);
		let weight = 1;
		this.setTitle(`${weight} points`);
			
		new Setting(this.contentEl)
		.setName("How many points should this task be worth?")
		.addButton((btn) =>
			btn
			.setButtonText('+')
			.setCta()
			.setClass("modalButton")
			.onClick(() => {
				weight++;
				this.setTitle(`${weight} points`);
			})
		)
		.addButton((btn) =>
			btn
			.setButtonText('-')
			.setCta()
			.setClass("modalButton")
			.onClick(() => {
				weight--;
				this.setTitle(`${weight} points`);
			})
		)
		.addButton((btn) =>
			btn
			.setButtonText('Submit')
			.setCta()
			.setClass("submitButton")
			.onClick(() => {
				this.close();
				onSubmit(`${weight}`);
			})
		);
	}
  }