Components.utils.import("chrome://sample/content/globalModule.js");

/****************************
CUSTOM EVENT AREA
****************************/
var customEventHandler = {
	init: function(){
		gBrowser.addEventListener("myCustomEvent", this, false, true);
	},
	
	handleEvent: function(event){
		try{
			url = event.target.getAttribute("attribute1");
			var aTab = gBrowser._getTabForContentWindow(event.target.ownerDocument.defaultView);
			var TabID = aTab.linkedPanel;
			CounterManager.registerURLtoTab(url, TabID);
			WriteToLog('M', url);
		}catch(exc){
			WriteToLog('X', exc.message);
		}
	}
};

/****************************
CLICK HANDLER OBJECT
****************************/	
var clickHandler = {
	init: function(){
		gBrowser.addEventListener("click", this, true);
	},
	
	handleEvent: function(event){
		try{
			var element = event.target;
			//check if a link was clicked
			var address = this.isLink(element);
			if(address /*&& !(address.startsWith("#"))*/){
				var aTab = gBrowser._getTabForContentWindow(event.target.ownerDocument.defaultView);
				var TabID = aTab.linkedPanel;
				var currentURL = gBrowser.currentURI;
				var url = this.fixURL(address, currentURL);
				CounterManager.registerURLtoTab(url, TabID);
				WriteToLog('C', url);
			}
		}catch(exc){
			WriteToLog('X', exc.message)
		}
	},
	
	isLink: function(element){
		if(element.tagName.toLowerCase() == "a"){
			return element.getAttribute("href");
		}
		else if(element.parentNode){
			return this.isLink(element.parentNode);
		}
		else{
			return null;
		}
	},
	
	fixURL: function(address, currentURL){
		if(address.startsWith("http://") || address.startsWith("https://")){
			return address;
		}
		else if(address.startsWith("//")){
			return currentURL.scheme + ":" + address;
		}
		else if(address.startsWith("/")){
			return currentURL.prePath + address;
		}
		else if(address.startsWith("#")){
			return currentURL.spec + address;
		}
		else{
			throw address;
		}	
	}
};

/****************************
TYPE HANDLER OBJECT
****************************/
var typeHandler = {
	init: function(){
		var old_handleCommand = gURLBar.handleCommand;
		gURLBar.handleCommand = function(event) {	
			var aTab = gBrowser._getTabForContentWindow(gBrowser.contentDocument.defaultView);
			var TabID = aTab.linkedPanel;
			var url = encodeURI(gURLBar.value);
			if(!(url.startsWith("http://") || url.startsWith("https://"))){
				url = "http://" + url;
			}
			CounterManager.registerURLtoTab(url, TabID);
			WriteToLog('T', url);
			old_handleCommand.call(gURLBar, event); 
		};
	}
};

/****************************
MAIN
****************************/
var myExt = function(){
	clickHandler.init();
	typeHandler.init();
	customEventHandler.init();
};

window.addEventListener("load", myExt, false);
