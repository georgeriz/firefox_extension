var EXPORTED_SYMBOLS = ["WriteToLog", "CounterManager"];

/************************
OUTPUT FILE
************************/
var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Desk", Components.interfaces.nsIFile);
file.append("clicked-address.txt");
var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
// PR_WRONLY | PR_CREATE_FILE | PR_APPEND
fos.init(file, 0x02 | 0x08 | 0x10, -1, 0);

function WriteToLog(){
	var date = new Date();
	var buffer = date.getTime();
	for(var i = 0; i < arguments.length; ++i){
		buffer += " " + arguments[i]
	}
	buffer += '\n';
	fos.write(buffer, buffer.length);
};

/************************
COUNTER MANAGER OBJECT
************************/
var CounterManager = {
	TabCollection: {},
	UserReqURLperTab: {},
	counter:0,
	
	counter_for_request: function(aURL, TabID, aCounter){
		try{
			if(this.isNewTab(TabID)){
				this.TabCollection[TabID] = {};
				this.TabCollection[TabID]["url"] = aURL;
				this.TabCollection[TabID]["counter"] = ++this.counter;
				this.TabCollection[TabID]["previous_counter"] = 0;
				this.UserReqURLperTab[TabID] = "";
			}
			else if(this.allowIncrease(aURL, TabID)){
				this.TabCollection[TabID]["previous_counter"] = this.TabCollection[TabID]["counter"];
				this.TabCollection[TabID]["url"] = aURL;
				this.TabCollection[TabID]["counter"] = ++this.counter;
				this.UserReqURLperTab[TabID] = "";
			}
			return this.TabCollection[TabID]["counter"];
		}catch(exc){
			return exc.message;
		}
	},
	
	counter_for_response: function(TabID, response_counter){
		if(response_counter < this.TabCollection[TabID]["initial_req_nunmber"]){
			return this.TabCollection[TabID]["previous_counter"];
		}
		return this.TabCollection[TabID]["counter"];
	},
	
	registerURLtoTab: function(aURL, TabID){
		this.UserReqURLperTab[TabID] = aURL;
	},
	
	allowIncrease: function(aURL, TabID){
		var reqURL = this.UserReqURLperTab[TabID];
		if(reqURL == ""){
			return false;
		}
		if(this.removeTrail(aURL) == this.removeTrail(reqURL)){
			return true;
		}
		else if(aURL.indexOf(encodeURIComponent(reqURL)) > -1) {
			return true;
		}
		else {
			//address bar search
			var search_items = reqURL.replace("http://", "").split("%20");
			if(search_items.length == 1){
				return false;
			}
			else{
				for (i in search_items){
					if(aURL.indexOf(search_items[i])==-1){
						return false;
					}
				}
				return true;
			}	
		}
	},

	isNewTab: function(TabID){
		if(TabID in this.TabCollection){
			return false;
		}
		return true;
	},
	
	removeTrail: function(url){
		if(url == null){
			return null
		}
		if(url.endsWith("/")){
			url = url.substring(0, url.length - 1);
		}
		return url;
	}
};

/************************
HELPER FUNCTIONS
************************/
//this function gets the content window of a request's loadContext
function getWindowForRequest(request){
	if (request instanceof Components.interfaces.nsIRequest){
		try{
			if (request.notificationCallbacks){
				return request.notificationCallbacks
											.getInterface(Components.interfaces.nsILoadContext)
											.associatedWindow;
			}
		} catch(e) {}
		try{			
			if (request.loadGroup && request.loadGroup.notificationCallbacks){
				return request.loadGroup.notificationCallbacks
											.getInterface(Components.interfaces.nsILoadContext)
											.associatedWindow;
			}
		} catch(e) {}
	}
	return null;
};

//this function returns window/tab related goodies of an httpChannel
function getTabID(request) {	
	var contentWindow = getWindowForRequest(request);//loadContext.associatedWindow;
	if (!contentWindow) {
		//this channel does not have a window, its probably loading a resource
		//this probably means that its loading an ajax call or like a google ad thing
		return null;
	} else {
		try{
			var aDOMWindow = contentWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIWebNavigation)
				.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
				.rootTreeItem
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow);
			var gBrowser = aDOMWindow.gBrowser;
			var aTab = gBrowser._getTabForContentWindow(contentWindow.top);
			var TabID = aTab.linkedPanel;
			return TabID;
		} catch(e) {}
	}
	return null;
};

/*********************
httpLog OBJECT
*********************/
var httpLog = {
	ReqCounter: 0,
	
	observe: function(subject, topic, data){
		var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
		var theURL = httpChannel.URI.spec;
		var TabID = getTabID(httpChannel);
		if(topic == "http-on-modify-request"){
			httpChannel.setRequestHeader("X-ReqCounter", ++this.ReqCounter, false);
		
			if(TabID){
				var c = CounterManager.counter_for_request(theURL, TabID, this.ReqCounter);
				WriteToLog('Q', theURL, c, this.ReqCounter);
				httpChannel.setRequestHeader("X-UserActionID", c, false);
			}else{
				WriteToLog('Q', theURL, 'N', this.ReqCounter);
			}			
		}		
		if(topic == "http-on-examine-response"){
			var reqCounter = "NotFound";
			var userActionID = "PROBLEM";
			try{
				reqCounter = httpChannel.getRequestHeader("X-ReqCounter");
				userActionID = httpChannel.getRequestHeader("X-UserActionID");
			}catch(ignore){}
			var referer = httpChannel.referrer ? httpChannel.referrer.spec : "NoReferer";
			
			if(userActionID == "PROBLEM"){
				WriteToLog('R', theURL, 'N', referer, reqCounter);
			}
			else{
				WriteToLog('R', theURL, userActionID, referer, reqCounter);
			}
		}
	}
};

var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
observerService.addObserver(httpLog, "http-on-modify-request", false);
observerService.addObserver(httpLog, "http-on-examine-response", false);
