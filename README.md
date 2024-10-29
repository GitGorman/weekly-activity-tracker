## Weekly Goal Tracker Plugin for Obsidian
This is a plugin for [Obsidian](https://obsidian.md) that allows you to add buttons to the status bar that allow you to track of different weekly goals and update them with ease. For example you could set a weekly exercise goal. The data is stored in the frontmatter of the Monday file of that week.
## Usage
### When the button is closed, it displays an icon, the current value and the goal value

![](Images/button_closed.png)

### When the goal has been reached, the button displays in color

![](Images/button_closed_color.png)

### Using left click, the button can opened to show a progress bar in color

![](Images/button_opened.png)

### **While the button is open, use right click to +1 to the goal**

## Settings
- Frontmatter value : the value in the frontmatter to read and write to
- Icon : the icon displayed in the status bar button. I recommend using [Emojipedia](https://emojipedia.org/) to find icons
- Goal : the weekly goal for activity
- Start color/end color : the gradient color for the status bar button, from left to right

## Help
If the frontmatter value does not exist in that week's Monday file, an error will be displayed and the button will go red. Update the file with the frontmatter value to fix this

![](Images/button_error.png)