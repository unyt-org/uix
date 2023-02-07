/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
  Initialisation code
 ------------------------------------------------------------------
**/
"use strict";

export var Espruino;

(function() {

  /** List of processors. These are functions that are called one
   * after the other with the data received from the last one.
   *
   * Common processors are:
   *
   *   jsCodeChanged        - called when the code in the editor changes with {code}
   *   sending              - sending code to Espruino (no data)
   *   transformForEspruino - transform code ready to be sent to Espruino
   *   transformModuleForEspruino({code,name})
   *           - transform module code before it's sent to Espruino with Modules.addCached (we only do this if we don't think it's been minified before)
   *   connected            - connected to Espruino (no data)
   *   disconnected         - disconnected from Espruino (no data)
   *   environmentVar       - Board's process.env loaded (object to be saved into Espruino.Env.environmentData)
   *   boardJSONLoaded      - Board's JSON was loaded into environmentVar
   *   getModule            - Called with data={moduleName:"foo", moduleCode:undefined} - moduleCode should be filled in if the module can be found
   *   getURL               - Called with data={url:"http://....", data:undefined) - data should be filled in if the URL is handled (See Espruino.Core.Utils.getURL to use this)
   *   terminalClear        - terminal has been cleared
   *   terminalPrompt       - we've received a '>' character (eg, `>` or `debug>`). The argument is the current line's contents.
   *   terminalNewLine      - When we get a new line on the terminal, this gets called with the last line's contents
   *   debugMode            - called with true or false when debug mode is entered or left
   *   editorHover          - called with { node : htmlNode, showTooltip : function(htmlNode) } when something is hovered over
   *   notification         - called with { mdg, type:"success","error"/"warning"/"info" }
   **/
  var processors = {};

  function init() {

    Espruino.Core.Config.loadConfiguration(function() {
      // Initialise all modules
      function initModule(modName, mod) {
        // console.log("Initialising "+modName);
        if (mod.init !== undefined)
          mod.init();
      }

      var module;
      for (module in Espruino.Core) initModule(module, Espruino.Core[module]);
      for (module in Espruino.Plugins) initModule(module, Espruino.Plugins[module]);

      callProcessor("initialised", undefined, function() {
        // We need the delay because of background.js's url_handler...
        setTimeout(function() {
          Espruino.initialised = true;
        }, 1000);
      });
    });
  }

  // Automatically start up when all is loaded
  if (typeof document!=="undefined") 
    document.addEventListener("DOMContentLoaded", init);

  /** Add a processor function of type function(data,callback) */
  function addProcessor(eventType, processor) {
    if (processors[eventType]===undefined)
      processors[eventType] = [];
    processors[eventType].push(processor);
  }

  /** Call a processor function */
  function callProcessor(eventType, data, callback) {
    var p = processors[eventType];
    // no processors
    if (p===undefined || p.length==0) {
      if (callback!==undefined) callback(data);
      return;
    }
    // now go through all processors
    var n = 0;
    var cbCalled = false;
    var cb = function(inData) {
      if (cbCalled) throw new Error("Internal error in "+eventType+" processor. Callback is called TWICE.");
      cbCalled = true;
      if (n < p.length) {
        cbCalled = false;
        p[n++](inData, cb);
      } else {
        if (callback!==undefined) callback(inData);
      }
    };
    cb(data);
  }

  // -----------------------------------
  Espruino = {
    Core : { },
    Plugins : { },
    addProcessor : addProcessor,
    callProcessor : callProcessor,
    initialised : false,
    init : init, // just in case we need to initialise this by hand
  };

  return Espruino;
})();


/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Central place to store and retrieve Options

 To use this, on your plugin's `init` function, do something like the
 following:

 Espruino.Core.Config.add("MAX_FOOBARS", {
    section : "Communications",           // Heading this will come under in the config screen
    name : "Foobars",                     // Nice name
    description : "How many foobars?",    // More detail about this
    type : "int"/"boolean"/"string"/{ value1:niceName, value2:niceName },
    defaultValue : 20,
    onChange : function(newValue) { ... }
  });

 * onChange will be called whenever the value changes from the default
 (including when it is loaded)

 Then use:

 Espruino.Config.MAX_FOOBARS in your code
 ------------------------------------------------------------------
 **/
"use strict";
(function() {

  /** See addSection and getSections */
  var builtinSections = {};

  function _get(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get( "CONFIGS", function (data) {
        var value = data["CONFIGS"];
        console.log("GET chrome.storage.sync = "+JSON.stringify(value));
        callback(value);
      });
    } else if (typeof window !== 'undefined' && window.localStorage) {
      var data = {};
      var value = window.localStorage.getItem("CONFIG");
      // console.log("GET window.localStorage = "+JSON.stringify(value));
      try {
        data = JSON.parse(value);
      } catch (e) {
        console.log("Invalid config data");
      }
      callback(data);
    } else if (typeof document != "undefined") {
      var data = {};
      var cookie = document.cookie;
      if (cookie!==undefined && cookie.indexOf("CONFIG=")>=0) {
        cookie = cookie.substring(cookie.indexOf("CONFIG=")+7);
        cookie = cookie.substring(0,cookie.indexOf(";"));
        try {
          var json = atob(cookie);
          data = JSON.parse(json);
        } catch (e) {
          console.log("Got ", e, " while reading info");
        }
      }
      callback(data);
    } else {
      callback({});
    }
  }

  function _set(data) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      console.log("SET chrome.storage.sync = "+JSON.stringify(data,null,2));
      chrome.storage.sync.set({ CONFIGS : data });
    } else if (typeof window !== 'undefined' && window.localStorage) {
      console.log("SET window.localStorage = "+JSON.stringify(data,null,2));
      window.localStorage.setItem("CONFIG",JSON.stringify(data));
    } else if (typeof document != "undefined") {
      document.cookie = "CONFIG="+btoa(JSON.stringify(data));
    }
  }

  function loadConfiguration(callback) {
    _get(function (value) {
      for (var key in value) {
        if (key=="set") continue;
        Espruino.Config[key] = value[key];
        if (Espruino.Core.Config.data[key] !== undefined &&
            Espruino.Core.Config.data[key].onChange !== undefined)
          Espruino.Core.Config.data[key].onChange(value[key]);
      }
      if (callback!==undefined)
        callback();
    });
  }

  function init() {
    addSection("General", { sortOrder:100, description: "General Web IDE Settings" });
    addSection("Communications", { sortOrder:200, description: "Settings for communicating with the Espruino Board" });
    addSection("Board", { sortOrder:300, description: "Settings for the Espruino Board itself" });
  }

  function add(name, options) {
    Espruino.Core.Config.data[name] = options;
    if (Espruino.Config[name] === undefined)
      Espruino.Config[name] = options.defaultValue;
  }

  /** Add a section (or information on the page).
   * options = {
   *   sortOrder : int, // a number used for sorting
   *   description : "",
   *   getHTML : function(callback(html)) // optional
   * };
   */
  function addSection(name, options) {
    options.name = name;
    builtinSections[name] = options;
  }

  /** Get an object containing the information on a section used in configs */
  function getSection(name) {
    if (builtinSections[name]!==undefined)
      return builtinSections[name];
    // not found - but we warned about this in getSections
    return {
      name : name
    };
  }

  /** Get an object containing information on all 'sections' used in all the configs */
  function getSections() {
    var sections = [];
    // add sections we know about
    for (var name in builtinSections)
      sections.push(builtinSections[name]);
    // add other sections
    for (var i in Espruino.Core.Config.data) {
      var c = Espruino.Core.Config.data[i];

      var found = false;
      for (var s in sections)
        if (sections[s].name == c.section)
          found = true;

      if (!found) {
        console.warn("Section named "+c.section+" was not added with Config.addSection");
        sections[c.section] = {
          name : c.section,
          sortOrder : 0
        };
      }
    }
    // Now sort by sortOrder
    sections.sort(function (a,b) { return a.sortOrder - b.sortOrder; });

    return sections;
  }

  Espruino.Config = {};
  Espruino.Config.set = function (key, value) {
    if (Espruino.Config[key] != value) {
      Espruino.Config[key] = value;
      // Do the callback
      if (Espruino.Core.Config.data[key] !== undefined &&
          Espruino.Core.Config.data[key].onChange !== undefined)
        Espruino.Core.Config.data[key].onChange(value);
      // Save to synchronized storage...
      var data = {};
      for (var key in Espruino.Config)
        if (key != "set")
          data[key] = Espruino.Config[key];
      _set(data);
    }
  };

  function clearAll() { // clear all settings
    _set({});
    for (var name in Espruino.Core.Config.data) {
      var options = Espruino.Core.Config.data[name];
      Espruino.Config[name] = options.defaultValue;
    }
  }

  Espruino.Core.Config = {
    loadConfiguration : loadConfiguration, // special - called before init

    init : init,
    add : add,
    data : {},


    addSection : addSection,
    getSection : getSection,
    getSections : getSections,

    clearAll : clearAll, // clear all settings
  };

})();


/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Board Environment variables (process.env) - queried when board connects
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  var environmentData = {};
  var boardData = {};

  function init() {
    Espruino.Core.Config.add("ENV_ON_CONNECT", {
      section : "Communications",
      name : "Request board details on connect",
      description : 'Just after the board is connected, should we query `process.env` to find out which board we\'re connected to? '+
          'This enables the Web IDE\'s code completion, compiler features, and firmware update notice.',
      type : "boolean",
      defaultValue : true,
    });

    Espruino.addProcessor("connected", function(data, callback) {
      // Give us some time for any stored data to come in
      setTimeout(queryBoardProcess, 500, data, callback);
    });
  }

  function queryBoardProcess(data, callback) {
    if ((!Espruino.Config.ENV_ON_CONNECT) ||
        (Espruino.Core.MenuFlasher && Espruino.Core.MenuFlasher.isFlashing())) {
      return callback(data);
    }

    Espruino.Core.Utils.executeExpression("process.env", function(result) {
      var json = {};
      if (result!==undefined) {
        try {
          json = JSON.parse(result);
        } catch (e) {
          console.log("JSON parse failed - " + e + " in " + JSON.stringify(result));
        }
      }
      if (Object.keys(json).length==0) {
        Espruino.Core.Notifications.error("Unable to retrieve board information.\nConnection Error?");
        // make sure we don't remember a previous board's info
        json = {
          VERSION : undefined,
          BOARD : undefined,
          MODULES : undefined,
          EXPTR : undefined
        };
      } else {
        if (json.BOARD && json.VERSION)
          Espruino.Core.Notifications.info("Found " +json.BOARD+", "+json.VERSION);
      }
      // now process the enviroment variables
      for (var k in json) {
        boardData[k] = json[k];
        environmentData[k] = json[k];
      }
      if (environmentData.VERSION) {
        var v = environmentData.VERSION;
        var vIdx = v.indexOf("v");
        if (vIdx>=0) {
          environmentData.VERSION_MAJOR = parseInt(v.substr(0,vIdx));
          var minor = v.substr(vIdx+1);
          var dot = minor.indexOf(".");
          if (dot>=0)
            environmentData.VERSION_MINOR = parseInt(minor.substr(0,dot)) + parseInt(minor.substr(dot+1))*0.001;
          else
            environmentData.VERSION_MINOR = parseFloat(minor);
        }
      }

      Espruino.callProcessor("environmentVar", environmentData, function(envData) {
        environmentData = envData;
        callback(data);
      });
    });
  }

  /** Get all data merged in from the board */
  function getData() {
    return environmentData;
  }

  /** Get just the board's environment data */
  function getBoardData() {
    return boardData;
  }

  /** Get a list of boards that we know about */
  function getBoardList(callback) {
    var jsonDir = Espruino.Config.BOARD_JSON_URL;

    // ensure jsonDir ends with slash
    if (jsonDir.indexOf('/', jsonDir.length - 1) === -1) {
      jsonDir += '/';
    }

    Espruino.Core.Utils.getJSONURL(jsonDir + "boards.json", function(boards){
      // now load all the individual JSON files
      var promises = [];
      for (var boardId in boards) {
        promises.push((function() {
          var id = boardId;
          return new Promise(function(resolve, reject) {
            Espruino.Core.Utils.getJSONURL(jsonDir + boards[boardId].json, function (data) {
              boards[id]["json"] = data;
              resolve();
            });
          });
        })());
      }

      // When all are loaded, load the callback
      Promise.all(promises).then(function() {
        callback(boards);
      });
    });
  }

  Espruino.Core.Env = {
    init : init,
    getData : getData,
    getBoardData : getBoardData,
    getBoardList : getBoardList,
    queryBoardData: queryBoardProcess
  };
}());


/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Actual low-level code for flashing Espruino Devices
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  var dataReceived = undefined; // listener for when data is received
  var bytesReceived = []; // list of characters for when no handler is specified

  var ACK = 0x79;
  var NACK = 0x1F;
  var DEFAULT_FLASH_OFFSET = 1024*10; /* Skip size of F1 bootloader by default */

  var setStatus = function() {};

  function init() {
  }

  var initialiseChip = function(callback, timeout) {
    setStatus("Initialising...");
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      clearInterval(iPoll);
      //callback("Can't find STM32 bootloader. Make sure the chip is reset with BOOT0=1 and BOOT1=0");
      callback("Can't find STM32 bootloader. Make sure the chip is reset into bootloader mode by holding down BTN1 while pressing RST");
    }, (timeout==undefined)?10000:timeout);
    var iPoll = setInterval(function() {
      console.log("Sending... 0x7F");
      Espruino.Core.Serial.write("\x7f", false);
    }, 70);
    dataReceived = function (c) {
      console.log("got "+c);
      if (c==ACK || c==NACK) {
        clearTimeout(iTimeout);
        clearInterval(iPoll);
        setStatus("Initialised.");
        // wait for random extra data...
        dataReceived = function(c){
          console.log("Already ACKed but got "+c);
        };
        setTimeout(function() {
          dataReceived = undefined;
          // finally call callback
          bodgeClock(callback);
        }, 500);
      }
    };
  };

  var waitForACK = function(callback, timeout) {
    var ms = timeout?timeout:1000;
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      callback("Timeout waiting for ACK - "+ms+"ms");
    }, ms);
    dataReceived = function (c) {
      //console.log("Got data "+JSON.stringify(c));
      dataReceived = undefined;
      if (c==ACK) {
        clearTimeout(iTimeout);
        callback(undefined);
      } else
        callback("Expected ACK but got "+c);
    };
  };

  var sendData = function(data, callback, timeout) {
    var s = "";
    var chksum = 0;
    for (var i in data) {
      chksum = chksum ^ data[i];
      s += String.fromCharCode(data[i]);
    }
    Espruino.Core.Serial.write(s + String.fromCharCode(chksum), false);
    /* wait for ACK *NOW* - not in the write callback, as by that time we
    may have already received the ACK we were looking for */
    waitForACK(callback, timeout);
  };

  var receiveData = function(count, callback, timeout) {
    var data = new Uint8Array(count);
    var dataCount = 0;
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      callback("Timeout reading "+count+" bytes");
    }, timeout?timeout:2000);
    dataReceived = function (c) {
      data[dataCount++] = c;
      if (dataCount == count) {
        clearTimeout(iTimeout);
        dataReceived = undefined;
        callback(undefined,data);
      }
    };
  };

  var sendCommand = function(command, callback) {
    Espruino.Core.Serial.write(String.fromCharCode(command) + String.fromCharCode(0xFF ^ command), false);
    /* wait for ACK *NOW* - not in the write callback, as by that time we
    may have already received the ACK we were looking for */
    waitForACK(callback);
  };

  var eraseChip = function(callback) {
    Espruino.Core.Status.setStatus("Erasing...");
    // Extended erase
    sendCommand(0x44, function(err) {
      if (err) { callback(err); return; }
      console.log("We may be some time...");
      sendData([0xFF,0xFF], function(err) {
        if (err) { callback(err); return; }
        callback(undefined);
      }, 20000/*timeout*/);
    });
  };

  var readData = function(callback, addr, readBytes) {
    console.log("Reading "+readBytes+" bytes from 0x"+addr.toString(16)+"...");
    // send read command
    sendCommand(0x11, function(err) {
      if (err) {
        console.log("Error sending command ("+err+").");
        callback(err);
        return;
      }
      // send address
      sendData([(addr>>24)&0xFF,(addr>>16)&0xFF,(addr>>8)&0xFF,addr&0xFF], function(err) {
        if (err) {
          console.log("Error sending address. ("+err+")");
          callback(err);
          return;
        }
        // send amount of bytes we want
        sendData([readBytes-1], function(err) {
          if (err) {
            console.log("Error while reading. ("+err+")");
            callback(err);
            return;
          }
          receiveData(readBytes, /*function(err) {
            if (err) {
              console.log("Error while reading. retrying...");
              initialiseChip(function (err) {
                if (err) callback(err);
                else readData(callback, addr, readBytes);
              }, 10000);
              return;
            }
            callback(undefined, data);
          }*/callback, 1000);
        }, 2000/*timeout*/);
      });
    });
  };

  var bodgeClock = function(callback) {
    /* 1v43 bootloader ran APB1 at 9Mhz, which isn't enough for
    some STM32 silicon, which has a bug. Instead, set the APB1 clock
    using the bootloader write command, which will fix it up enough for
    flashing.   */
    var RCC_CFGR = 0x40021004;
    readData(function(err, data) {
      if (err) return callback(err);
      var word = (data[3]<<24) | (data[2]<<16) | (data[1]<<8) | data[0];
      console.log("RCC->CFGR = "+word);
      var newword = (word&0xFFFFF8FF) | 0x00000400;
      if (newword==word) {
        console.log("RCC->CFGR is correct");
        callback(undefined);
      } else {
        console.log("Setting RCC->CFGR to "+newword);
        writeData(callback, RCC_CFGR, [newword&0xFF, (newword>>8)&0xFF, (newword>>16)&0xFF, (newword>>24)&0xFF]);
      }
    }, RCC_CFGR, 4);
  };

  var writeData = function(callback, addr, data) {
    if (data.length>256) callback("Writing too much data");
    console.log("Writing "+data.length+" bytes at 0x"+addr.toString(16)+"...");
    // send write command
    sendCommand(0x31, function(err) {
      if (err) {
        console.log("Error sending command ("+err+"). retrying...");
        initialiseChip(function (err) {
          if (err) callback(err);
          else writeData(callback, addr, data);
        }, 30000);
        return;
      }
      // send address
      sendData([(addr>>24)&0xFF,(addr>>16)&0xFF,(addr>>8)&0xFF,addr&0xFF], function(err) {
        if (err) {
          console.log("Error sending address ("+err+"). retrying...");
          initialiseChip(function (err) {
            if (err) callback(err);
            else writeData(callback, addr, data);
          }, 30000);
          return;
        }
        // work out data to send
        var sData = [ data.length-1 ];
        // for (var i in data) doesn't just do 0..data.length-1 in node!
        for (var i=0;i<data.length;i++) sData.push(data[i]&0xFF);
        // send data
        sendData(sData, function(err) {
          if (err) {
            console.log("Error while writing ("+err+"). retrying...");
            initialiseChip(function (err) {
              if (err) callback(err);
              else writeData(callback, addr, data);
            }, 30000);
            return;
          }
          callback(undefined); // done
        }, 2000/*timeout*/);
      });
    });
  };

  var writeAllData = function(binary, flashOffset, callback) {
    var chunkSize = 256;
    console.log("Writing "+binary.byteLength+" bytes");
    Espruino.Core.Status.setStatus("Writing flash...",  binary.byteLength);
    var writer = function(offset) {
      if (offset>=binary.byteLength) {
        Espruino.Core.Status.setStatus("Write complete!");
        callback(undefined); // done
        return;
      }
      var len = binary.byteLength - offset;
      if (len > chunkSize) len = chunkSize;
      var data = new Uint8Array(binary, offset, len);
      writeData(function(err) {
        if (err) { callback(err); return; }
        Espruino.Core.Status.incrementProgress(chunkSize);
        writer(offset + chunkSize);
      }, 0x08000000 + offset, data);
    };
    writer(flashOffset);
  };

  var readAllData = function(binaryLength, flashOffset, callback) {
    var data = new Uint8Array(flashOffset);
    var chunkSize = 256;
    console.log("Reading "+binaryLength+" bytes");
    Espruino.Core.Status.setStatus("Reading flash...",  binaryLength);
    var reader = function(offset) {
      if (offset>=binaryLength) {
        Espruino.Core.Status.setStatus("Read complete!");
        callback(undefined, data); // done
        return;
      }
      var len = binaryLength - offset;
      if (len > chunkSize) len = chunkSize;
      readData(function(err, dataChunk) {
        if (err) { callback(err); return; }
        for (var i in dataChunk)
          data[offset+i] = dataChunk[i];
        Espruino.Core.Status.incrementProgress(chunkSize);
        reader(offset + chunkSize);
      }, 0x08000000 + offset, chunkSize);
    };
    reader(flashOffset);
  };

  function flashBinaryToDevice(binary, flashOffset, callback, statusCallback) {
    setStatus = function(x) {
      if (!Espruino.Core.Status.hasProgress())
        Espruino.Core.Status.setStatus(x);
      if (statusCallback) statusCallback(x);
    }
    if (typeof flashOffset === 'function') {
      // backward compatibility if flashOffset is missed
      callback = flashOffset;
      flashOffset = null;
    }

    if (!flashOffset && flashOffset !== 0) {
      flashOffset = DEFAULT_FLASH_OFFSET;
    }

    if (typeof binary == "string") {
      var buf = new ArrayBuffer(binary.length);
      var a = new Uint8Array(buf);
      for (var i=0;i<binary.length;i++)
        a[i] = binary.charCodeAt(i);
      binary = buf;
    }
    // add serial listener
    dataReceived = undefined;
    Espruino.Core.Serial.startListening(function (readData) {
      var bufView=new Uint8Array(readData);
      //console.log("Got "+bufView.length+" bytes");
      for (var i=0;i<bufView.length;i++) bytesReceived.push(bufView[i]);
      if (dataReceived!==undefined) {
        for (var i=0;i<bytesReceived.length;i++) {
          if (dataReceived===undefined) console.log("OH NO!");
          dataReceived(bytesReceived[i]);
        }
        bytesReceived = [];
      }
    });
    Espruino.Core.Serial.setBinary(true);
    var hadSlowWrite = Espruino.Core.Serial.isSlowWrite();
    Espruino.Core.Serial.setSlowWrite(false, true/*force*/);
    var oldHandler;
    if (Espruino.Core.Terminal) {
      oldHandler = Espruino.Core.Terminal.setInputDataHandler(function() {
        // ignore keyPress from terminal during flashing
      });
    }
    var finish = function(err) {
      Espruino.Core.Serial.setSlowWrite(hadSlowWrite);
      Espruino.Core.Serial.setBinary(false);
      if (Espruino.Core.Terminal)
        Espruino.Core.Terminal.setInputDataHandler(oldHandler);
      callback(err);
    };
    // initialise
    initialiseChip(function (err) {
      if (err) { finish(err); return; }
      setStatus("Erasing...");
      eraseChip(function (err) {
        if (err) { finish(err); return; }
        setStatus("Writing Firmware...");
        writeAllData(binary, flashOffset, function (err) {
          if (err) { finish(err); return; }
          finish();
        });
      });
      /*readAllData(binary.byteLength, function(err,chipData) {
        if (err) {
          finish(err);
          return;
        }
        var errors = 0;
        var needsErase = false;
        var binaryData = new Uint8Array(binary, 0, binary.byteLength);
        for (var i=FLASH_OFFSET;i<binary.byteLength;i++) {
          if (binaryData[i]!=chipData[i]) {
            if (chipData[i]!=0xFF) needsErase = true;
            console.log(binaryData[i]+" vs "+data[i]);
            errors++;
          }
        }
        console.log(errors+" differences, "+(needsErase?"needs erase":"doesn't need erase"));
      });*/
    });
  }

  function flashDevice(url, flashOffset, callback, statusCallback) {
    Espruino.Core.Utils.getBinaryURL(url, function (err, binary) {
      if (err) { callback(err); return; }
      console.log("Downloaded "+binary.byteLength+" bytes");
      flashBinaryToDevice(binary, flashOffset, callback, statusCallback);
    });
  };


  function resetDevice(callback) {
    // add serial listener
    dataReceived = undefined;
    Espruino.Core.Serial.startListening(function (readData) {
      var bufView=new Uint8Array(readData);
      //console.log("Got "+bufView.length+" bytes");
      for (var i=0;i<bufView.length;i++) bytesReceived.push(bufView[i]);
      if (dataReceived!==undefined) {
        for (var i=0;i<bytesReceived.length;i++) {
          if (dataReceived===undefined) console.log("OH NO!");
          dataReceived(bytesReceived[i]);
        }
        bytesReceived = [];
      }
    });
    Espruino.Core.Serial.setBinary(true);
    var hadSlowWrite = Espruino.Core.Serial.isSlowWrite();
    Espruino.Core.Serial.setSlowWrite(false, true/*force*/);
    var oldHandler = Espruino.Core.Terminal.setInputDataHandler(function() {
      // ignore keyPress from terminal during flashing
    });
    var finish = function(err) {
      Espruino.Core.Serial.setSlowWrite(hadSlowWrite);
      Espruino.Core.Serial.setBinary(false);
      Espruino.Core.Terminal.setInputDataHandler(oldHandler);
      callback(err);
    };
    // initialise
    initialiseChip(function (err) {
      if (err) return finish(err);
      var data = new Uint8Array([0x04,0x00,0xFA,0x05]);
      var addr = 0xE000ED0C;
      console.log("Writing "+data.length+" bytes at 0x"+addr.toString(16)+"...");
      // send write command
      sendCommand(0x31, function(err) {
        if (err) return finish(err);
        // send address
        sendData([(addr>>24)&0xFF,(addr>>16)&0xFF,(addr>>8)&0xFF,addr&0xFF], function(err) {
          if (err) return finish(err);
          // work out data to send
          // for (var i in data) doesn't just do 0..data.length-1 in node!
          for (var i=0;i<data.length;i++) sData.push(data[i]&0xFF);
          var s = "";
          var chksum = 0;
          for (var i in sData) {
            chksum = chksum ^ sData[i];
            s += String.fromCharCode(sData[i]);
          }
          Espruino.Core.Serial.write(s + String.fromCharCode(chksum), false, finish);
        }, 2000/*timeout*/);
      });
    });
  };



  Espruino.Core.Flasher = {
    init : init,
    flashDevice : flashDevice,
    flashBinaryToDevice : flashBinaryToDevice,
    resetDevice : resetDevice
  };
}());


/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Automatically load any referenced modules
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  function init() {
    Espruino.Core.Config.add("MODULE_URL", {
      section : "Communications",
      name : "Module URL",
      description : "Where to search online for modules when `require()` is used",
      type : "string",
      defaultValue : "https://www.espruino.com/modules"
    });
    Espruino.Core.Config.add("MODULE_EXTENSIONS", {
      section : "Communications",
      name : "Module Extensions",
      description : "The file extensions to use for each module. These are checked in order and the first that exists is used. One or more file extensions (including the dot) separated by `|`",
      type : "string",
      defaultValue : ".min.js|.js"
    });
    Espruino.Core.Config.add("MODULE_AS_FUNCTION", {
      section : "Communications",
      name : "Modules uploaded as functions",
      description : "Espruino 1v90 and later ONLY. Upload modules as Functions, allowing any functions inside them to be loaded directly from flash when 'Save on Send' is enabled.",
      type : "boolean",
      defaultValue : true
    });

    Espruino.Core.Config.add("MODULE_PROXY_ENABLED", {
      section : "Communications",
      name : "Enable Proxy",
      description : "Enable Proxy for loading the modules when `require()` is used (only in native IDE)",
      type : "boolean",
      defaultValue : false
    });

    Espruino.Core.Config.add("MODULE_PROXY_URL", {
      section : "Communications",
      name : "Proxy URL",
      description : "Proxy URL for loading the modules when `require()` is used (only in native IDE)",
      type : "string",
      defaultValue : ""
    });

    Espruino.Core.Config.add("MODULE_PROXY_PORT", {
      section : "Communications",
      name : "Proxy Port",
      description : "Proxy Port for loading the modules when `require()` is used (only in native IDE)",
      type : "string",
      defaultValue : ""
    });

    // When code is sent to Espruino, search it for modules and add extra code required to load them
    Espruino.addProcessor("transformForEspruino", function(code, callback) {
      if (Espruino.Config.ROLLUP) {
        return loadModulesRollup(code, callback);
      }
      loadModules(code, callback);
    });

    // Append the 'getModule' processor as the last (plugins get initialized after Espruino.Core modules)
    Espruino.Plugins.CoreModules = {
      init: function() {
        Espruino.addProcessor("getModule", function(data, callback) {
          if (data.moduleCode!==undefined) { // already provided be previous getModule processor
            return callback(data);
          }

          fetchGetModule(data, callback);
        });
      }
    };
  }

  function isBuiltIn(module) {
    var d = Espruino.Core.Env.getData();
    // If we got data from the device itself, use that as the
    // definitive answer
    if ("string" == typeof d.MODULES)
      return d.MODULES.split(",").indexOf(module)>=0;
    // Otherwise try and figure it out from JSON
    if ("info" in d &&
        "builtin_modules" in d.info &&
        d.info.builtin_modules.indexOf(module)>=0)
      return true;
    // Otherwise assume we don't have it
    return false;
  }

  /** Find any instances of require(...) in the code string and return a list */
  var getModulesRequired = function(code) {
    var modules = [];

    var lex = Espruino.Core.Utils.getLexer(code);
    var tok = lex.next();
    var state = 0;
    while (tok!==undefined) {
      if (state==0 && tok.str=="require") {
        state=1;
      } else if (state==1 && tok.str=="(") {
        state=2;
      } else if (state==2 && (tok.type=="STRING")) {
        state=0;
        var module = tok.value;
        if (!isBuiltIn(module) && modules.indexOf(module)<0)
          modules.push(module);
      } else
        state = 0;
      tok = lex.next();
    }

    return modules;
  };

  /** Download modules from MODULE_URL/.. */
  function fetchGetModule(data, callback) {
    var fullModuleName = data.moduleName;

    // try and load the module the old way...
    console.log("loadModule("+fullModuleName+")");

    var urls = []; // Array of where to look for this module
    var modName; // Simple name of the module
    if(Espruino.Core.Utils.isURL(fullModuleName)) {
      modName = fullModuleName.substr(fullModuleName.lastIndexOf("/") + 1).split(".")[0];
      urls = [ fullModuleName ];
    } else {
      modName = fullModuleName;
      Espruino.Config.MODULE_URL.split("|").forEach(function (url) {
        url = url.trim();
        if (url.length!=0)
          Espruino.Config.MODULE_EXTENSIONS.split("|").forEach(function (extension) {
            urls.push(url + "/" + fullModuleName + extension);
          })
      });
    };

    // Recursively go through all the urls
    (function download(urls) {
      if (urls.length==0) {
        return callback(data);
      }
      var dlUrl = urls[0];
      Espruino.Core.Utils.getURL(dlUrl, function (code) {
        if (code!==undefined) {
          // we got it!
          data.moduleCode = code;
          data.isMinified = dlUrl.substr(-7)==".min.js";
          return callback(data);
        } else {
          // else try next
          download(urls.slice(1));
        }
      });
    })(urls);
  }


  /** Called from loadModule when a module is loaded. Parse it for other modules it might use
   *  and resolve dfd after all submodules have been loaded */
  function moduleLoaded(resolve, requires, modName, data, loadedModuleData, alreadyMinified){
    // Check for any modules used from this module that we don't already have
    var newRequires = getModulesRequired(data);
    console.log(" - "+modName+" requires "+JSON.stringify(newRequires));
    // if we need new modules, set them to load and get their promises
    var newPromises = [];
    for (var i in newRequires) {
      if (requires.indexOf(newRequires[i])<0) {
        console.log("   Queueing "+newRequires[i]);
        requires.push(newRequires[i]);
        newPromises.push(loadModule(requires, newRequires[i], loadedModuleData));
      } else {
        console.log("   Already loading "+newRequires[i]);
      }
    }

    var loadProcessedModule = function (module) {
      // if we needed to load something, wait until it's loaded before resolving this
      Promise.all(newPromises).then(function(){
        // add the module to end of our array
        if (Espruino.Config.MODULE_AS_FUNCTION)
          loadedModuleData.push("Modules.addCached(" + JSON.stringify(module.name) + ",function(){" + module.code + "});");
        else
          loadedModuleData.push("Modules.addCached(" + JSON.stringify(module.name) + "," + JSON.stringify(module.code) + ");");
        // We're done
        resolve();
      });
    }
    if (alreadyMinified)
      loadProcessedModule({code:data,name:modName});
    else
      Espruino.callProcessor("transformModuleForEspruino", {code:data,name:modName}, loadProcessedModule);
  }

  /** Given a module name (which could be a URL), try and find it. Return
   * a deferred thingybob which signals when we're done. */
  function loadModule(requires, fullModuleName, loadedModuleData) {
    return new Promise(function(resolve, reject) {
      // First off, try and find this module using callProcessor
      Espruino.callProcessor("getModule",
          { moduleName:fullModuleName, moduleCode:undefined, isMinified:false },
          function(data) {
            if (data.moduleCode===undefined) {
              Espruino.Core.Notifications.warning("Module "+fullModuleName+" not found");
              return resolve();
            }

            // great! it found something. Use it.
            moduleLoaded(resolve, requires, fullModuleName, data.moduleCode, loadedModuleData, data.isMinified);
          });
    });
  }

  /** Finds instances of 'require' and then ensures that
   those modules are loaded into the module cache beforehand
   (by inserting the relevant 'addCached' commands into 'code' */
  function loadModules(code, callback){
    var loadedModuleData = [];
    var requires = getModulesRequired(code);
    if (requires.length == 0) {
      // no modules needed - just return
      callback(code);
    } else {
      Espruino.Core.Status.setStatus("Loading modules");
      // Kick off the module loading (each returns a promise)
      var promises = requires.map(function (moduleName) {
        return loadModule(requires, moduleName, loadedModuleData);
      });
      // When all promises are complete
      Promise.all(promises).then(function(){
        callback(loadedModuleData.join("\n") + "\n" + code);
      });
    }
  }

  function loadModulesRollup(code, callback) {
    rollupTools.loadModulesRollup(code)
        .then(generated => {
          const minified = generated.code;
          console.log('rollup: '+minified.length+' bytes');

          // FIXME: needs warnings?
          Espruino.Core.Notifications.info('Rollup no errors. Bundling ' + code.length + ' bytes to ' + minified.length + ' bytes');
          callback(minified);
        })
        .catch(err => {
          console.log('rollup:error', err);
          Espruino.Core.Notifications.error("Rollup errors - Bundling failed: " + String(err).trim());
          callback(code);
        });
  }

  Espruino.Core.Modules = {
    init : init
  };
}());


/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Display Notifications
 ------------------------------------------------------------------
 **/
"use strict";

(function() {

  function init()
  {
  }

  Espruino.Core.Notifications = {
    init : init,
    success: function(msg, setStatus)
    {
      console.log("|SUCCESS| ", msg)
    },
    error: function(msg, setStatus)
    {
      console.log("|ERROR| ", msg)
    },
    warning: function(msg, setStatus)
    {
      Espruino.callProcessor("notification",{type:"warning",msg:msg},function(){});
    },
    info: function(msg, setStatus)
    {
      Espruino.callProcessor("notification",{type:"info",msg:msg},function(){});
    }
  };

})();


Espruino.Core.Status = {
  // init : init,
  setStatus : (s)=>{},//console.log("STATUS:: ", s),
  hasProgress : (s)=>{},
  incrementProgress : (s)=>{console.log("progress", s)},
  // showStatusWindow : showStatusWindow,
  // hideStatusWindow : hideStatusWindow
};



/* --------------------------------------------------------------
         EspruinoTools/core/serial.js
   -------------------------------------------------------------- */
/*
Gordon Williams (gw@pur3.co.uk)

Common entrypoint for all communications from the IDE. This handles
all serial_*.js connection types and passes calls to the correct one.

To add a new serial device, you must add an object to
  Espruino.Core.Serial.devices:

  Espruino.Core.Serial.devices.push({
    "name" : "Test",               // Name, when initialising
    "init" : function()            // Gets called at startup
    "getStatus" : function(ignoreSettings)   // Optional - returns:
      // true - all ok
      // {error: error_string}
      // {warning: warning_string}
    "getPorts": function(callback) // calls 'callback' with an array of ports:
        callback([{path:"TEST",          // path passed to 'open' (and displayed to user)
                   description:"test",   // description displayed to user
                   type:"test",           // bluetooth|usb|socket - used to show icon in UI
                   // autoconnect : true  // automatically conect to this (without the connect menu)
                   // promptsUser : true  // this is set if we expect the Web Browser to prompt the user for this item
                 }], true); // instantPorts - will getPorts return all the ports on the first call, or does it need multiple calls (eg. Bluetooth)
    "open": function(path, openCallback, receiveCallback, disconnectCallback),
    "write": function(dataAsString, callbackWhenWritten)
    "close": function(),
    "maxWriteLength": 20, // optional - the maximum amount of characters that should be given to 'write' at a time
  });

*/
(function() {
      // If XOFF flow control is received, this is how long we wait
      // before resuming anyway
      const FLOW_CONTROL_RESUME_TIMEOUT = 20000;
      // 20 sec

      // List of ports and the devices they map to
      var portToDevice = undefined;
      // The current connected device (from Espruino.Core.Serial.devices)
      var currentDevice = undefined;

      // called when data received
      var readListener = undefined;

      // are we sending binary data? If so, don't automatically insert breaks for stuff like Ctrl-C
      var sendingBinary = false;
      // For throttled write
      var slowWrite = true;
      var writeData = [];
      var writeTimeout = undefined;
      /// flow control XOFF received - we shouldn't send anything
      var flowControlXOFF = false;
      /// Set up when flow control received - if no response is received we start sending anyway
      var flowControlTimeout;

      function init() {
        Espruino.Core.Config.add("BAUD_RATE", {
          section: "Communications",
          name: "Baud Rate",
          description: "When connecting over serial, this is the baud rate that is used. 9600 is the default for Espruino",
          type: {
            9600: 9600,
            14400: 14400,
            19200: 19200,
            28800: 28800,
            38400: 38400,
            57600: 57600,
            115200: 115200
          },
          defaultValue: 9600,
        });
        Espruino.Core.Config.add("SERIAL_IGNORE", {
          section: "Communications",
          name: "Ignore Serial Ports",
          description: "A '|' separated list of serial port paths to ignore, eg `/dev/ttyS*|/dev/*.SOC`",
          type: "string",
          defaultValue: "/dev/ttyS*|/dev/*.SOC|/dev/*.MALS"
        });
        Espruino.Core.Config.add("SERIAL_FLOW_CONTROL", {
          section: "Communications",
          name: "Software Flow Control",
          description: "Respond to XON/XOFF flow control characters to throttle data uploads. By default Espruino sends XON/XOFF for USB and Bluetooth (on 2v05+).",
          type: "boolean",
          defaultValue: true
        });

        var devices = Espruino.Core.Serial.devices;
        for (var i = 0; i < devices.length; i++) {
          // console.log("  - Initialising Serial " + devices[i].name);
          if (devices[i].init)
            devices[i].init();
        }
      }

      var startListening = function(callback) {
        var oldListener = readListener;
        readListener = callback;
        return oldListener;
      };

      /* Calls 'callback(port_list, shouldCallAgain)'
     'shouldCallAgain==true' means that more devices
     may appear later on (eg Bluetooth LE).*/
      var getPorts = function(callback) {
        var ports = [];
        var newPortToDevice = [];
        // get all devices
        var responses = 0;
        var devices = Espruino.Core.Serial.devices;
        if (!devices || devices.length == 0) {
          portToDevice = newPortToDevice;
          return callback(ports, false);
        }
        var shouldCallAgain = false;
        devices.forEach(function(device) {
          //console.log("getPorts -->",device.name);
          device.getPorts(function(devicePorts, instantPorts) {
            //console.log("getPorts <--",device.name);
            if (instantPorts === false)
              shouldCallAgain = true;
            if (devicePorts) {
              devicePorts.forEach(function(port) {
                var ignored = false;
                if (Espruino.Config.SERIAL_IGNORE)
                  Espruino.Config.SERIAL_IGNORE.split("|").forEach(function(wildcard) {
                    var regexp = "^" + wildcard.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
                    if (port.path.match(new RegExp(regexp)))
                      ignored = true;
                  });

                if (!ignored) {
                  if (port.usb && port.usb[0] == 0x0483 && port.usb[1] == 0x5740)
                    port.description = "Espruino board";
                  ports.push(port);
                  newPortToDevice[port.path] = device;
                }
              });
            }
            responses++;
            if (responses == devices.length) {
              portToDevice = newPortToDevice;
              ports.sort(function(a, b) {
                if (a.unimportant && !b.unimportant)
                  return 1;
                if (b.unimportant && !a.unimportant)
                  return -1;
                return 0;
              });
              callback(ports, shouldCallAgain);
            }
          });
        });
      };

      var openSerial = function(serialPort, connectCallback, disconnectCallback) {
        return openSerialInternal(serialPort, connectCallback, disconnectCallback, 2);
      }

      var openSerialInternal = function(serialPort, connectCallback, disconnectCallback, attempts) {
        /* If openSerial is called, we need to have called getPorts first
      in order to figure out which one of the serial_ implementations
      we must call into. */
        if (portToDevice === undefined) {
          portToDevice = [];
          // stop recursive calls if something errors
          return getPorts(function() {
            openSerialInternal(serialPort, connectCallback, disconnectCallback, attempts);
          });
        }

        if (!(serialPort in portToDevice)) {
          if (serialPort.toLowerCase()in portToDevice) {
            serialPort = serialPort.toLowerCase();
          } else {
            if (attempts > 0) {
              console.log("Port " + JSON.stringify(serialPort) + " not found - checking ports again (" + attempts + " attempts left)");
              return getPorts(function() {
                openSerialInternal(serialPort, connectCallback, disconnectCallback, attempts - 1);
              });
            } else {
              console.error("Port " + JSON.stringify(serialPort) + " not found");
              return connectCallback(undefined);
            }
          }
        }

        var portInfo = {
          port: serialPort
        };
        var connectionInfo = undefined;
        var flowControlXOFF = false;
        if (flowControlTimeout) {
          clearTimeout(flowControlTimeout);
          flowControlTimeout = undefined;
        }
        currentDevice = portToDevice[serialPort];
        currentDevice.open(serialPort, function(cInfo) {
          // CONNECT
          if (!cInfo) {
            //        Espruino.Core.Notifications.error("Unable to connect");
            console.error("Unable to open device (connectionInfo=" + cInfo + ")");
            connectCallback(undefined);
          } else {
            connectionInfo = cInfo;
            var connectedPort = serialPort;
            console.log("Connected", cInfo);
            if (connectionInfo.portName)
              portInfo.portName = connectionInfo.portName;
            Espruino.callProcessor("connected", portInfo, function() {
              connectCallback(cInfo);
            });
          }
        }, function(data) {
          // RECEIEVE DATA
          if (!(data instanceof ArrayBuffer))
            console.warn("Serial port implementation is not returning ArrayBuffers");
          if (Espruino.Config.SERIAL_FLOW_CONTROL) {
            var u = new Uint8Array(data);
            for (var i = 0; i < u.length; i++) {
              if (u[i] == 17) {
                // XON
                console.log("XON received => resume upload");
                flowControlXOFF = false;
                if (flowControlTimeout) {
                  clearTimeout(flowControlTimeout);
                  flowControlTimeout = undefined;
                }
              }
              if (u[i] == 19) {
                // XOFF
                console.log("XOFF received => pause upload");
                flowControlXOFF = true;
                if (flowControlTimeout)
                  clearTimeout(flowControlTimeout);
                flowControlTimeout = setTimeout(function() {
                  console.log("XOFF timeout => resume upload anyway");
                  flowControlXOFF = false;
                  flowControlTimeout = undefined;
                }, FLOW_CONTROL_RESUME_TIMEOUT);
              }
            }
          }
          if (readListener)
            readListener(data);
        }, function() {
          // DISCONNECT
          currentDevice = undefined;
          if (writeTimeout !== undefined)
            clearTimeout(writeTimeout);
          writeTimeout = undefined;
          writeData = [];
          sendingBinary = false;
          flowControlXOFF = false;
          if (flowControlTimeout) {
            clearTimeout(flowControlTimeout);
            flowControlTimeout = undefined;
          }
          if (!connectionInfo) {
            // we got a disconnect when we hadn't connected...
            // Just call connectCallback(undefined), don't bother sending disconnect
            connectCallback(undefined);
            return;
          }
          connectionInfo = undefined;
          Espruino.callProcessor("disconnected", portInfo, function() {
            disconnectCallback(portInfo);
          });
        });
      };

      var str2ab = function(str) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0; i < str.length; i++) {
          var ch = str.charCodeAt(i);
          if (ch >= 256) {
            console.warn("Attempted to send non-8 bit character - code " + ch);
            ch = "?".charCodeAt(0);
          }
          bufView[i] = ch;
        }
        return buf;
      };

      var closeSerial = function() {
        if (currentDevice) {
          currentDevice.close();
          currentDevice = undefined;
        } else
          console.error("Close called, but serial port not open");
      };

      var isConnected = function() {
        return currentDevice !== undefined;
      };

      var writeSerialWorker = function(isStarting) {
        writeTimeout = undefined;
        // we've been called
        // check flow control
        if (flowControlXOFF) {
          /* flow control was enabled - bit hacky (we could use a callback)
    but safe - just check again in a bit to see if we should send */
          writeTimeout = setTimeout(function() {
            writeSerialWorker();
          }, 50);
          return;
        }

        // if we disconnected while sending, empty queue
        if (currentDevice === undefined) {
          if (writeData[0].callback)
            writeData[0].callback();
          writeData.shift();
          if (writeData.length)
            setTimeout(function() {
              writeSerialWorker(false);
            }, 1);
          return;
        }

        if (writeData[0].data === "") {
          if (writeData[0].showStatus)
            Espruino.Core.Status.setStatus("Sent");
          if (writeData[0].callback)
            writeData[0].callback();
          writeData.shift();
          // remove this empty first element
          if (!writeData.length)
            return;
          // anything left to do?
          isStarting = true;
        }

        if (isStarting) {
          var blockSize = 512;
          if (currentDevice.maxWriteLength)
            blockSize = currentDevice.maxWriteLength;
          /* if we're throttling our writes we want to send small
     * blocks of data at once. We still limit the size of
     * sent blocks to 512 because on Mac we seem to lose
     * data otherwise (not on any other platforms!) */
          if (slowWrite)
            blockSize = 19;
          writeData[0].blockSize = blockSize;

          writeData[0].showStatus &= writeData[0].data.length > writeData[0].blockSize;
          if (writeData[0].showStatus) {
            Espruino.Core.Status.setStatus("Sending...", writeData[0].data.length);
            console.log("---> " + JSON.stringify(writeData[0].data));
          }
        }

        // Initial split use previous, or don't
        var d = undefined;
        var split = writeData[0].nextSplit || {
          start: 0,
          end: writeData[0].data.length,
          delay: 0
        };
        // if we get something like Ctrl-C or `reset`, wait a bit for it to complete
        if (!sendingBinary) {
          function findSplitIdx(prev, substr, delay, reason) {
            var match = writeData[0].data.match(substr);
            // not found
            if (match === null)
              return prev;
            // or previous find was earlier in str
            var end = match.index + match[0].length;
            if (end > prev.end)
              return prev;
            // found, and earlier
            prev.start = match.index;
            prev.end = end;
            prev.delay = delay;
            prev.match = match[0];
            prev.reason = reason;
            return prev;
          }
          split = findSplitIdx(split, /\x03/, 250, "Ctrl-C");
          // Ctrl-C
          split = findSplitIdx(split, /reset\(\);\n/, 250, "reset()");
          // Reset
          split = findSplitIdx(split, /load\(\);\n/, 250, "load()");
          // Load
          split = findSplitIdx(split, /Modules.addCached\("[^\n]*"\);\n/, 250, "Modules.addCached");
          // Adding a module
          split = findSplitIdx(split, /\x10require\("Storage"\).write\([^\n]*\);\n/, 500, "Storage.write");
          // Write chunk of data
        }
        // Otherwise split based on block size
        if (!split.match || split.end >= writeData[0].blockSize) {
          if (split.match)
            writeData[0].nextSplit = split;
          split = {
            start: 0,
            end: writeData[0].blockSize,
            delay: 0
          };
        }
        if (split.match)
          console.log("Splitting for " + split.reason + ", delay " + split.delay);
        // Only send some of the data
        if (writeData[0].data.length > split.end) {
          if (slowWrite && split.delay == 0)
            split.delay = 50;
          d = writeData[0].data.substr(0, split.end);
          writeData[0].data = writeData[0].data.substr(split.end);
          if (writeData[0].nextSplit) {
            writeData[0].nextSplit.start -= split.end;
            writeData[0].nextSplit.end -= split.end;
            if (writeData[0].nextSplit.end <= 0)
              writeData[0].nextSplit = undefined;
          }
        } else {
          d = writeData[0].data;
          writeData[0].data = "";
          writeData[0].nextSplit = undefined;
        }
        // update status
        if (writeData[0].showStatus)
          Espruino.Core.Status.incrementProgress(d.length);
        // actually write data
        //console.log("Sending block "+JSON.stringify(d)+", wait "+split.delay+"ms");
        currentDevice.write(d, function() {
          // Once written, start timeout
          writeTimeout = setTimeout(function() {
            writeSerialWorker();
          }, split.delay);
        });
      }

      // Throttled serial write
      var writeSerial = function(data, showStatus, callback) {
        if (showStatus === undefined)
          showStatus = true;

        /* Queue our data to write. If there was previous data and no callback to
    invoke on this data or the previous then just append data. This would happen
    if typing in the terminal for example. */
        if (!callback && writeData.length && !writeData[writeData.length - 1].callback) {
          writeData[writeData.length - 1].data += data;
        } else {
          writeData.push({
            data: data,
            callback: callback,
            showStatus: showStatus
          });
          /* if this is our first data, start sending now. Otherwise we're already
    busy sending and will pull data off writeData when ready */
          if (writeData.length == 1)
            writeSerialWorker(true);
        }
      };

      // ----------------------------------------------------------
      Espruino.Core.Serial = {
        "devices": [],
        // List of devices that can provide a serial API
        "init": init,
        "getPorts": getPorts,
        "open": openSerial,
        "isConnected": isConnected,
        "startListening": startListening,
        "write": writeSerial,
        "close": closeSerial,
        "isSlowWrite": function() {
          return slowWrite;
        },
        "setSlowWrite": function(isOn, force) {
          if ((!force) && Espruino.Config.SERIAL_THROTTLE_SEND) {
            console.log("ForceThrottle option is set - set Slow Write = true");
            isOn = true;
          } else
            // console.log("Set Slow Write = " + isOn);
          slowWrite = isOn;
        },
        "setBinary": function(isOn) {
          sendingBinary = isOn;
        }
      };
    }
)();


/*
Gordon Williams (gw@pur3.co.uk)

If we're running in an iframe, this gets enabled and allows the IDE
to work by passing messages using window.postMessage.

Use embed.js on the client side to link this in.
*/

(function() {
  if (typeof window == "undefined" || typeof window.parent == undefined) return;
  // console.log("serial_frame: Running in a frame - enabling frame messaging");
  var ENABLED = true;

  var callbacks = {
    connected : undefined,
    receive : undefined,
    written : undefined,
    disconnected : undefined,
    ports : undefined
  };

  window.addEventListener('message', function(e) {
    var event = e.data;
    //console.log("IDE MESSAGE ---------------------------------------");
    //console.log(event);
    //console.log("-----------------------------------------------");
    if (typeof event!="object" || event.for!="ide") return;
    switch (event.type) {
      case "initialised": {
        // response to init. Could disable if we don't get this?
      } break;
      case "ports": if (callbacks.ports) {
        callbacks.ports(event.data);
        callbacks.ports = undefined;
      } break;
      case "connect":
        if (Espruino.Core.Serial.isConnected())
          console.error("serial_frame: already connected");

        Espruino.Core.MenuPortSelector.connectToPort(event.data, function() {
          console.log("serial_frame: connected");
        });
        break;
      case "connected": if (callbacks.connected) {
        callbacks.connected({ok:true});
        callbacks.connected = undefined;
      } break;
      case "disconnected": if (callbacks.disconnected) {
        callbacks.disconnected();
        callbacks.disconnected = undefined;
      } break;
      case "written": if (callbacks.written) {
        callbacks.written();
        callbacks.written = undefined;
      } break;
      case "receive": if (callbacks.receive) {
        if (typeof event.data!="string")
          console.error("serial_frame: receive event expecting data string");
        callbacks.receive(Espruino.Core.Utils.stringToArrayBuffer(event.data));
      } break;
      case "setMaxWriteLength": {
        // Set the maximum amount of data we're allowed to write in one go
        device.maxWriteLength = parseInt(event.data);
      } break;
      default:
        console.error("Unknown event type ",event.type);
        break;
    }
  });

  function post(msg) {
    msg.from="ide";
    window.parent.postMessage(msg,"*");
  }

  var device = {
    "name" : "window.postMessage",
    "init" : function() {
      post({type:"init"});
    },
    "getPorts": function(callback) {
      if (!ENABLED) {
        callback([], true/*instantPorts*/);
        return;
      }
      post({type:"getPorts"});
      var timeout = setTimeout(function() {
        timeout = undefined;
        callbacks.ports = undefined;
        callback([], false/*instantPorts*/);
        // console.error("serial_frame: getPorts timeout, disabling");
        ENABLED = false;
      },100);
      callbacks.ports = function(d) {
        if (!timeout) {
          console.error("serial_frame: ports received after timeout");
          return;
        }
        clearTimeout(timeout);
        timeout = undefined;
        callback(d, false/*instantPorts*/);
      };
    },
    "open": function(path, openCallback, receiveCallback, disconnectCallback) {
      callbacks.connected = openCallback;
      callbacks.receive = receiveCallback;
      callbacks.disconnected = disconnectCallback;
      post({type:"connect",data:path});
    },
    "write": function(d, callback) {
      callbacks.written = callback;
      post({type:"write",data:d});
    },
    "close": function() {
      post({type:"disconnect"});
    },
  };
  Espruino.Core.Serial.devices.push(device);
})();


(function () {

  /* On Linux, BLE normally needs admin right to be able to access BLE
  *
  * sudo apt-get install libcap2-bin
  * sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
  */

  if (typeof require === 'undefined') return;
  var noble = undefined;

  var NORDIC_SERVICE = "6e400001b5a3f393e0a9e50e24dcca9e";
  var NORDIC_TX = "6e400002b5a3f393e0a9e50e24dcca9e";
  var NORDIC_RX = "6e400003b5a3f393e0a9e50e24dcca9e";
  var NORDIC_TX_MAX_LENGTH = 20;

  var initialised = false;
  var errored = false;
  var scanWhenInitialised = undefined;

  function findByUUID(list, uuid) {
    for (var i=0;i<list.length;i++)
      if (list[i].uuid==uuid) return list[i];
    return undefined;
  }

  // map of bluetooth devices found by getPorts
  var btDevices = {};
  var newDevices = [];
  var lastDevices = [];

  var btDevice;
  var txCharacteristic;
  var rxCharacteristic;
  var txInProgress = false;
  var scanStopTimeout = undefined;


  function init() {
    Espruino.Core.Config.add("BLUETOOTH_LOW_ENERGY", {
      section: "Communications",
      name: "Connect over Bluetooth Smart (BTLE) via 'noble'",
      descriptionHTML: 'Allow connection to Espruino via BLE with the Nordic UART implementation',
      type: "boolean",
      defaultValue: true
    });
  }

  function startNoble() {
    try {
      try {
        noble = require('noble');
      } catch (e) {
        noble = require('@abandonware/noble');
      }
    } catch (e) {
      console.log("Noble: module couldn't be loaded, no node.js Bluetooth Low Energy\n", e);
      // super nasty workaround for https://github.com/sandeepmistry/noble/issues/502
      process.removeAllListeners('exit');
      errored = true;
      return false;
    }

    noble.on('stateChange', function(state) {
      console.log("Noble: stateChange -> "+state);
      if (state=="poweredOn") {
        if (Espruino.Config.WEB_BLUETOOTH) {
          // Everything has already initialised, so we must disable
          // web bluetooth this way instead
          console.log("Noble: Disable Web Bluetooth as we have Noble instead");
          Espruino.Config.WEB_BLUETOOTH = false;
        }
        initialised = true;
        /* if getPorts was called before initialisation, be sure
        to wait for stuff to arrive before just calling back
        with nothing - we're in the CLI */
        if (scanWhenInitialised) {
          var scb = scanWhenInitialised;
          scanWhenInitialised = undefined;
          getPorts(function() {
            setTimeout(function() {
              getPorts(scb);
            }, 1500);
          });
        }
      }
      if (state=="poweredOff") {
        initialised = false;
        if (scanWhenInitialised) {
          var scb = scanWhenInitialised;
          scanWhenInitialised = undefined;
          scb(undefined, true/*instantPorts*/);
        }
      }
    });

    noble.on('discover', function(dev) {
      if (!dev.advertisement) return;
      for (var i in newDevices)
        if (newDevices[i].path == dev.address) return; // already seen it
      var name = dev.advertisement.localName || dev.address;
      var hasUartService = dev.advertisement.serviceUuids &&
          dev.advertisement.serviceUuids.indexOf(NORDIC_SERVICE)>=0;
      if (hasUartService ||
          Espruino.Core.Utils.isRecognisedBluetoothDevice(name)) {
        console.log("Noble: Found UART device:", name, dev.address);
        newDevices.push({ path: dev.address, description: name, type : "bluetooth" });
        btDevices[dev.address] = dev;
      } else console.log("Noble: Found device:", name, dev.address);
    });

    // if we didn't initialise for whatever reason, keep going anyway
    setTimeout(function() {
      if (initialised) return;
      console.log("Noble: Didn't initialise in 10 seconds, disabling.");
      errored = true;
      if (scanWhenInitialised) {
        scanWhenInitialised([]);
        scanWhenInitialised = undefined;
      }
    }, 10000);
    return true;
  }

  var getPorts = function (callback) {
    if (errored || !Espruino.Config.BLUETOOTH_LOW_ENERGY) {
      console.log("Noble: getPorts - disabled");
      callback([], true/*instantPorts*/);
    } else if (!initialised) {
      if (!noble)
        if (!startNoble())
          return callback([]);
      console.log("Noble: getPorts - not initialised");
      // if not initialised yet, wait until we are
      if (scanWhenInitialised) scanWhenInitialised([]);
      scanWhenInitialised = callback;
    } else { // all ok - let's go!
      // Ensure we're scanning
      if (scanStopTimeout) {
        clearTimeout(scanStopTimeout);
        scanStopTimeout = undefined;
      } else {
        console.log("Noble: Starting scan");
        lastDevices = [];
        newDevices = [];
        noble.startScanning([], true);
      }
      scanStopTimeout = setTimeout(function () {
        scanStopTimeout = undefined;
        console.log("Noble: Stopping scan");
        noble.stopScanning();
      }, 3000);
      // report back device list from both the last scan and this one...
      var reportedDevices = [];
      newDevices.forEach(function (d) {
        reportedDevices.push(d);
      });
      lastDevices.forEach(function (d) {
        var found = false;
        reportedDevices.forEach(function (dv) {
          if (dv.path == d.path) found = true;
        });
        if (!found) reportedDevices.push(d);
      });
      reportedDevices.sort(function (a, b) { return a.path.localeCompare(b.path); });
      lastDevices = newDevices;
      newDevices = [];
      //console.log("Noble: reportedDevices",reportedDevices);
      callback(reportedDevices, false/*instantPorts*/);
    }
  };

  var openSerial = function (serialPort, openCallback, receiveCallback, disconnectCallback) {
    btDevice = btDevices[serialPort];
    if (btDevice === undefined) throw "BT device not found"

    if (scanStopTimeout) {
      clearTimeout(scanStopTimeout);
      scanStopTimeout = undefined;
      console.log("Noble: Stopping scan (openSerial)");
      noble.stopScanning();
    }

    txInProgress = false;

    console.log("BT> Connecting");
    btDevice.on('disconnect', function() {
      txCharacteristic = undefined;
      rxCharacteristic = undefined;
      btDevice = undefined;
      txInProgress = false;
      disconnectCallback();
    });

    btDevice.connect(function (error) {
      if (error) {
        console.log("BT> ERROR Connecting");
        btDevice = undefined;
        return openCallback();
      }
      console.log("BT> Connected");

      btDevice.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
        var btUARTService = findByUUID(services, NORDIC_SERVICE);
        txCharacteristic = findByUUID(characteristics, NORDIC_TX);
        rxCharacteristic = findByUUID(characteristics, NORDIC_RX);
        if (error || !btUARTService || !txCharacteristic || !rxCharacteristic) {
          console.log("BT> ERROR getting services/characteristics");
          console.log("Service "+btUARTService);
          console.log("TX "+txCharacteristic);
          console.log("RX "+rxCharacteristic);
          btDevice.disconnect();
          txCharacteristic = undefined;
          rxCharacteristic = undefined;
          btDevice = undefined;
          return openCallback();
        }

        rxCharacteristic.on('data', function (data) {
          receiveCallback(new Uint8Array(data).buffer);
        });
        rxCharacteristic.subscribe(function() {
          openCallback({});
        });
      });
    });
  };

  var closeSerial = function () {
    if (btDevice) {
      btDevice.disconnect(); // should call disconnect callback?
    }
  };

  // Throttled serial write
  var writeSerial = function (data, callback) {
    if (txCharacteristic === undefined) return;

    if (data.length>NORDIC_TX_MAX_LENGTH) {
      console.error("BT> TX length >"+NORDIC_TX_MAX_LENGTH);
      return callback();
    }
    if (txInProgress) {
      console.error("BT> already sending!");
      return callback();
    }

    console.log("BT> send "+JSON.stringify(data));
    txInProgress = true;
    try {
      txCharacteristic.write(Espruino.Core.Utils.stringToBuffer(data), false, function() {
        txInProgress = false;
        return callback();
      });
    } catch (e) {
      console.log("BT> SEND ERROR " + e);
      closeSerial();
    }
  };

  // ----------------------------------------------------------

  Espruino.Core.Serial.devices.push({
    "name" : "Noble Bluetooth LE",
    "init": init,
    "getPorts": getPorts,
    "open": openSerial,
    "write": writeSerial,
    "close": closeSerial,
    "maxWriteLength" : NORDIC_TX_MAX_LENGTH,
  });
})();

(function() {

  // Fix up prefixing
  if (typeof navigator == "undefined") {
    console.log("Not running in a browser - Web Bluetooth not enabled");
    return;
  }

  function checkCompatibility() {
    if (!navigator.bluetooth) {
      console.log("No navigator.bluetooth - Web Bluetooth not enabled");
      return false;
    }
    if (navigator.bluetooth.requestDevice &&
        navigator.bluetooth.requestDevice.toString().indexOf('callExtension') >= 0) {
      console.log("Using Urish's Windows 10 Web Bluetooth Polyfill");
    } else if (navigator.platform.indexOf("Win")>=0 &&
        (navigator.userAgent.indexOf("Chrome/")>=0)) {
      var chromeVer = navigator.userAgent.match(/Chrome\/(\d+)/);
      if (chromeVer && chromeVer[1]<68) {
        console.log("Web Bluetooth available, but Windows Web Bluetooth is broken in <68 - not using it");
        return false;
      }
    }
    if (window && window.location && window.location.protocol=="http:") {
      console.log("Serving off HTTP (not HTTPS) - Web Bluetooth not enabled");
      return false;
    }
    return true;
  }

  var WEB_BLUETOOTH_OK = true;
  var NORDIC_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  var NORDIC_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  var NORDIC_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  var NORDIC_TX_MAX_LENGTH = 20;
  var testedCompatibility = false;
  // List of previously paired devices that we could reconnect to without the chooser
  var pairedDevices = [];

  var btServer = undefined;
  var connectionDisconnectCallback;

  var txCharacteristic;
  var rxCharacteristic;
  var txInProgress = false;

  function init() {
    /* If BLE is handled some other way (eg winnus), then it
    can be disabled here */
    if (Espruino.Core.Serial.NO_WEB_BLUETOOTH) {
      WEB_BLUETOOTH_OK = false;
      return;
    }

    Espruino.Core.Config.add("WEB_BLUETOOTH", {
      section : "Communications",
      name : "Connect over Bluetooth Smart (Web Bluetooth)",
      descriptionHTML : 'Allow connection to Espruino via BLE with the Nordic UART implementation',
      type : "boolean",
      defaultValue : true,
    });
  }

  function getPorts(callback) {
    if (!testedCompatibility) {
      testedCompatibility = true;
      /* Check compatibility here - the Web Bluetooth Polyfill for windows
      loads after everything else, so we can't check when this page is
      parsed.*/
      if (!checkCompatibility())
        WEB_BLUETOOTH_OK = false;
    }
    if (Espruino.Config.WEB_BLUETOOTH && WEB_BLUETOOTH_OK) {
      var list = [{path:'Web Bluetooth', description:'Bluetooth Low Energy', type : "bluetooth"}];
      pairedDevices.forEach(function(btDevice) {
        list.push({path:btDevice.name, description:'Web Bluetooth device', type : "bluetooth"});
      });
      callback(list, true/*instantPorts*/);;
    } else
      callback(undefined, true/*instantPorts*/);
  }

  /** MODIFIED */
  async function openSerial(serialPort, openCallback, receiveCallback, disconnectCallback) {
    connectionDisconnectCallback = disconnectCallback;

    var btDevice;
    var btService;

    var promise;
    let server;
    // Check for pre-paired devices
    btDevice = pairedDevices.find(btDevice=>btDevice.name == serialPort);
    if (btDevice) {
      console.log("Pre-paired Web Bluetooth device already found");
      promise = await btDevice.gatt.connect();
    } else {
      var filters = [];
      Espruino.Core.Utils.recognisedBluetoothDevices().forEach(function(namePrefix) {
        filters.push({ namePrefix: namePrefix });
      });
      filters.push({ services: [ NORDIC_SERVICE ] });

      /** MODIFIED */
      let devices = await navigator.bluetooth.getDevices();
      if (devices.length==0) {
        console.error("no device permissions");
        promise = navigator.bluetooth.requestDevice({
          filters: filters,
          optionalServices: [ NORDIC_SERVICE ]}).then(function(device) {
          btDevice = device;
          Espruino.Core.Status.setStatus("Connecting to "+btDevice.name);
          console.log('BT>  Device Name:       ' + btDevice.name);
          console.log('BT>  Device ID:         ' + btDevice.id);
          // Was deprecated: Should use getPrimaryServices for this in future
          //console.log('BT>  Device UUIDs:      ' + device.uuids.join('\n' + ' '.repeat(21)));
          btDevice.addEventListener('gattserverdisconnected', function() {
            console.log("BT> Disconnected (gattserverdisconnected)");
            closeSerial();
          }, {once:true});
          return btDevice.gatt.connect();
        })
      }
      else {
        btDevice = devices[0]
        promise = devices[0].gatt.connect();
      }
    }

    promise.then(function(server) {
      Espruino.Core.Status.setStatus("Connected to BLE");
      console.log("BT> Connected");
      btServer = server;
      return server.getPrimaryService(NORDIC_SERVICE);
    }).then(function(service) {
      Espruino.Core.Status.setStatus("Configuring BLE...");
      console.log("BT> Got service");
      btService = service;
      return btService.getCharacteristic(NORDIC_RX);
    }).then(function (characteristic) {
      Espruino.Core.Status.setStatus("Configuring BLE....");
      rxCharacteristic = characteristic;
      console.log("BT> RX characteristic:"+JSON.stringify(rxCharacteristic));
      rxCharacteristic.addEventListener('characteristicvaluechanged', function(event) {
        // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
        var value = event.target.value.buffer;
        //console.log("BT> RX:"+JSON.stringify(Espruino.Core.Utils.arrayBufferToString(value)));
        receiveCallback(value);
      });
      return rxCharacteristic.startNotifications();
    }).then(function() {
      Espruino.Core.Status.setStatus("Configuring BLE....");
      return btService.getCharacteristic(NORDIC_TX);
    }).then(function (characteristic) {
      Espruino.Core.Status.setStatus("Configuring BLE.....");
      txCharacteristic = characteristic;
      console.log("BT> TX characteristic:"+JSON.stringify(txCharacteristic));
    }).then(function() {
      Espruino.Core.Status.setStatus("Configuring BLE.....");
      txInProgress = false;
      Espruino.Core.Serial.setSlowWrite(false, true); // hack - leave throttling up to this implementation
      if (!pairedDevices.includes(btDevice))
        pairedDevices.push(btDevice);
      setTimeout(function() {
        Espruino.Core.Status.setStatus("BLE configured. Receiving data...");
        openCallback({ portName : btDevice.name });
      }, 500);
    }).catch(function(error) {
      // console.log('BT> ERROR: ' + error);
      if (btServer) {
        btServer.disconnect();
        btServer = undefined;
        txCharacteristic = undefined;
        rxCharacteristic = undefined;
      }
      if (connectionDisconnectCallback) {
        connectionDisconnectCallback(undefined);
        connectionDisconnectCallback = undefined;
      }
    });
  }

  function closeSerial() {
    if (btServer) {
      btServer.disconnect();
      btServer = undefined;
      txCharacteristic = undefined;
      rxCharacteristic = undefined;
    }
    if (connectionDisconnectCallback) {
      connectionDisconnectCallback();
      connectionDisconnectCallback = undefined;
    }
  }

  // Throttled serial write
  function writeSerial(data, callback) {
    if (!txCharacteristic) return;

    if (data.length>NORDIC_TX_MAX_LENGTH) {
      console.error("BT> TX length >"+NORDIC_TX_MAX_LENGTH);
      return callback();
    }
    if (txInProgress) {
      console.error("BT> already sending!");
      return callback();
    }

    txInProgress = true;
    txCharacteristic.writeValue(Espruino.Core.Utils.stringToArrayBuffer(data)).then(function() {
      txInProgress = false;
      callback();
    }).catch(function(error) {
      console.log('BT> SEND ERROR: ' + error);
      closeSerial();
    });
  }

  // ----------------------------------------------------------

  Espruino.Core.Serial.devices.push({
    "name" : "Web Bluetooth",
    "init" : init,
    "getPorts": getPorts,
    "open": openSerial,
    "write": writeSerial,
    "close": closeSerial,
    "maxWriteLength" : NORDIC_TX_MAX_LENGTH,
  });
})();


(function() {

  // Fix up prefixing
  if (typeof navigator == "undefined") {
    console.log("Not running in a browser - Web Serial not enabled");
    return;
  }

  function checkCompatibility() {
    if (!navigator.serial) {
      console.log("No navigator.serial - Web Serial not enabled");
      return false;
    }
    if (window && window.location && window.location.protocol=="http:" &&
        window.location.hostname!="localhost") {
      console.log("Serving off HTTP (not HTTPS) - Web Serial not enabled");
      return false;
    }
    return true;
  }

  var WEB_SERIAL_OK = true;
  var testedCompatibility = false;

  var serialPort = undefined;
  var connectionDisconnectCallback;

  function init() {
    Espruino.Core.Config.add("WEB_SERIAL", {
      section : "Communications",
      name : "Connect over Serial (Web Serial)",
      descriptionHTML : 'Allow connection to Espruino from the Web Browser via Serial. The API must currently be enabled by pasting <code>chrome://flags#enable-experimental-web-platform-features</code> into the address bar and clicking <code>Enable</code>',
      type : "boolean",
      defaultValue : true,
    });
  }

  function getPorts(callback) {
    if (!testedCompatibility) {
      testedCompatibility = true;
      if (!checkCompatibility())
        WEB_SERIAL_OK = false;
    }
    if (Espruino.Config.WEB_SERIAL && WEB_SERIAL_OK)
      callback([{path:'Web Serial', description:'Serial', type : "serial"}], true/*instantPorts*/);
    else
      callback(undefined, true/*instantPorts*/);
  }

  async function openSerial(_, openCallback, receiveCallback, disconnectCallback) {
    // TODO: Pass USB vendor and product ID filter when supported by Chrome.
    // TODO: Retrieve device name when/if supported and use a pairedDevices list like in Web Bluetooth
    let available_ports = await navigator.serial.getPorts();

    if (available_ports.length) {
      serialPort = available_ports[0];
      console.log("Found serial port");
    }
    else {
      serialPort = await navigator.serial.requestPort()
      console.log("Connecting to serial port");
    }
    await serialPort.open({ baudrate: parseInt(Espruino.Config.BAUD_RATE), baudRate: parseInt(Espruino.Config.BAUD_RATE) });

    try {
      function readLoop() {
        var reader = serialPort.readable.getReader();
        reader.read().then(function ({ value, done }) {
          reader.releaseLock();
          if (value) {
            receiveCallback(value.buffer);
          }
          if (done) {
            disconnectCallback();
          } else {
            readLoop();
          }
        });
      }
      readLoop();
      Espruino.Core.Status.setStatus("Serial connected. Receiving data...");
      // TODO: Provide a device name when supported by Chrome.
      openCallback({});
    }
    catch (error) {
       console.log('Serial> ERROR: ' + error);
       disconnectCallback();
    }
  }

  function closeSerial() {
    if (serialPort) {
      serialPort.close();
      serialPort = undefined;
    }
    if (connectionDisconnectCallback) {
      connectionDisconnectCallback();
      connectionDisconnectCallback = undefined;
    }
  }

  function writeSerial(data, callback) {
    var writer = serialPort.writable.getWriter();
    writer.write(Espruino.Core.Utils.stringToArrayBuffer(data)).then(function() {
      callback();
    }).catch(function(error) {
      console.log('Serial> SEND ERROR: ' + error);
      closeSerial();
    });
    writer.releaseLock();
  }

  // ----------------------------------------------------------

  Espruino.Core.Serial.devices.push({
    "name" : "Web Serial",
    "init" : init,
    "getPorts": getPorts,
    "open": openSerial,
    "write": writeSerial,
    "close": closeSerial,
  });
})();



/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Utilities
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  function init() {

  }

  function isWindows() {
    return (typeof navigator!="undefined") && navigator.userAgent.indexOf("Windows")>=0;
  }

  function isAppleDevice() {
    return (typeof navigator!="undefined") && (typeof window!="undefined") && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function getChromeVersion(){
    return parseInt(window.navigator.appVersion.match(/Chrome\/(.*?) /)[1].split(".")[0]);
  }

  function isNWApp() {
    return (typeof require === "function") && (typeof require('nw.gui') !== "undefined");
  }

  function isChromeWebApp() {
    return ((typeof chrome === "object") && chrome.app && chrome.app.window);
  }

  function isProgressiveWebApp() {
    return !isNWApp() && !isChromeWebApp() && window && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  function hasNativeTitleBar() {
    return !isNWApp() && !isChromeWebApp();
  }

  function escapeHTML(text, escapeSpaces)
  {
    escapeSpaces = typeof escapeSpaces !== 'undefined' ? escapeSpaces : true;

    var chr = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;', ' ' : (escapeSpaces ? '&nbsp;' : ' ') };

    return text.toString().replace(/[\"&<> ]/g, function (a) { return chr[a]; });
  }

  /* Google Docs, forums, etc tend to break code by replacing characters with
  fancy unicode versions. Un-break the code by undoing these changes */
  function fixBrokenCode(text)
  {
    // make sure we ignore `&shy;` - which gets inserted
    // by the forum's code formatter
    text = text.replace(/\u00AD/g,'');
    // replace quotes that get auto-replaced by Google Docs and other editors
    text = text.replace(/[\u201c\u201d]/g,'"');
    text = text.replace(/[\u2018\u2019]/g,'\'');

    return text;
  }


  function getSubString(str, from, len) {
    if (len == undefined) {
      return str.substr(from, len);
    } else {
      var s = str.substr(from, len);
      while (s.length < len) s+=" ";
      return s;
    }
  };

  /** Get a Lexer to parse JavaScript - this is really very nasty right now and it doesn't lex even remotely properly.
   * It'll return {type:"type", str:"chars that were parsed", value:"string", startIdx: Index in string of the start, endIdx: Index in string of the end}, until EOF when it returns undefined */
  function getLexer(str) {
    // Nasty lexer - no comments/etc
    var chAlpha="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    var chNum="0123456789";
    var chAlphaNum = chAlpha+chNum;
    var chWhiteSpace=" \t\n\r";
    var chQuotes = "\"'`";
    var ch;
    var idx = 0;
    var lineNumber = 1;
    var nextCh = function() {
      ch = str[idx++];
      if (ch=="\n") lineNumber++;
    };
    nextCh();
    var isIn = function(s,c) { return s.indexOf(c)>=0; } ;
    var nextToken = function() {
      while (isIn(chWhiteSpace,ch)) {
        nextCh();
      }
      if (ch==undefined) return undefined;
      if (ch=="/") {
        nextCh();
        if (ch=="/") {
          // single line comment
          while (ch!==undefined && ch!="\n") nextCh();
          return nextToken();
        } else if (ch=="*") {
          nextCh();
          var last = ch;
          nextCh();
          // multiline comment
          while (ch!==undefined && !(last=="*" && ch=="/")) {
            last = ch;
            nextCh();
          }
          nextCh();
          return nextToken();
        }
        return {type:"CHAR", str:"/", value:"/", startIdx:idx-2, endIdx:idx-1, lineNumber:lineNumber};
      }
      var s = "";
      var type, value;
      var startIdx = idx-1;
      if (isIn(chAlpha,ch)) { // ID
        type = "ID";
        do {
          s+=ch;
          nextCh();
        } while (isIn(chAlphaNum,ch));
      } else if (isIn(chNum,ch)) { // NUMBER
        type = "NUMBER";
        var chRange = chNum;
        if (ch=="0") { // Handle
          s+=ch;
          nextCh();
          if ("xXoObB".indexOf(ch)>=0) {
            if (ch=="b" || ch=="B") chRange="01";
            if (ch=="o" || ch=="O") chRange="01234567";
            if (ch=="x" || ch=="X") chRange="0123456789ABCDEFabcdef";
            s+=ch;
            nextCh();
          }
        }
        while (isIn(chRange,ch) || ch==".") {
          s+=ch;
          nextCh();
        }
      } else if (isIn(chQuotes,ch)) { // STRING
        type = "STRING";
        var q = ch;
        value = "";
        s+=ch;
        nextCh();
        while (ch!==undefined && ch!=q) {
          s+=ch;
          if (ch=="\\") {
            nextCh();
            s+=ch;
            // FIXME: handle hex/etc correctly here
          }
          value += ch;
          nextCh();
        };
        if (ch!==undefined) s+=ch;
        nextCh();
      } else {
        type = "CHAR";
        s+=ch;
        nextCh();
      }
      if (value===undefined) value=s;
      return {type:type, str:s, value:value, startIdx:startIdx, endIdx:idx-1, lineNumber:lineNumber};
    };

    return {
      next : nextToken
    };
  };

  /** Count brackets in a string - will be 0 if all are closed */
  function countBrackets(str) {
    var lex = getLexer(str);
    var brackets = 0;
    var tok = lex.next();
    while (tok!==undefined) {
      if (tok.str=="(" || tok.str=="{" || tok.str=="[") brackets++;
      if (tok.str==")" || tok.str=="}" || tok.str=="]") brackets--;
      tok = lex.next();
    }
    return brackets;
  }

  /** Try and get a prompt from Espruino - if we don't see one, issue Ctrl-C
   * and hope it comes back. Calls callback with first argument true if it
   had to Ctrl-C out */
  function getEspruinoPrompt(callback) {
    callback();
    return;
    if (Espruino.Core.Terminal!==undefined &&
        Espruino.Core.Terminal.getTerminalLine()==">") {
      console.log("Found a prompt... great!");
      return callback();
    }

    var receivedData = "";
    var prevReader = Espruino.Core.Serial.startListening(function (readData) {
      var bufView = new Uint8Array(readData);
      for(var i = 0; i < bufView.length; i++) {
        receivedData += String.fromCharCode(bufView[i]);
      }
      if (receivedData[receivedData.length-1] == ">") {
        if (receivedData.substr(-6)=="debug>") {
          console.log("Got debug> - sending Ctrl-C to break out and we'll be good");
          Espruino.Core.Serial.write('\x03');
        } else {
          if (receivedData == "\r\n=undefined\r\n>")
            receivedData=""; // this was just what we expected - so ignore it

          console.log("Received a prompt after sending newline... good!");
          clearTimeout(timeout);
          nextStep();
        }
      }
    });
    // timeout in case something goes wrong...
    var hadToBreak = false;
    var timeout = setTimeout(function() {
      console.log("Got "+JSON.stringify(receivedData));
      // if we haven't had the prompt displayed for us, Ctrl-C to break out of what we had
      console.log("No Prompt found, got "+JSON.stringify(receivedData[receivedData.length-1])+" - issuing Ctrl-C to try and break out");
      Espruino.Core.Serial.write('\x03');
      hadToBreak = true;
      timeout = setTimeout(function() {
        console.log("Still no prompt - issuing another Ctrl-C");
        Espruino.Core.Serial.write('\x03');
        nextStep();
      },500);
    },500);
    // when we're done...
    var nextStep = function() {
      // send data to console anyway...
      if(prevReader) prevReader(receivedData);
      receivedData = "";
      // start the previous reader listening again
      Espruino.Core.Serial.startListening(prevReader);
      // call our callback
      if (callback) callback(hadToBreak);
    };
    // send a newline, and we hope we'll see '=undefined\r\n>'
    Espruino.Core.Serial.write('\n');
  };

  /** Return the value of executing an expression on the board. If
   If exprPrintsResult=false/undefined the actual value returned by the expression is returned.
   If exprPrintsResult=true, whatever expression prints to the console is returned */
  function executeExpression(expressionToExecute, callback, exprPrintsResult) {
    var receivedData = "";
    var hadDataSinceTimeout = false;
    var allDataSent = false;

    var progress = 100;
    function incrementProgress() {
      if (progress==100) {
        Espruino.Core.Status.setStatus("Receiving...",100);
        progress=0;
      } else {
        progress++;
        Espruino.Core.Status.incrementProgress(1);
      }
    }

    function getProcessInfo(expressionToExecute, callback) {
      var prevReader = Espruino.Core.Serial.startListening(function (readData) {
        var bufView = new Uint8Array(readData);
        for(var i = 0; i < bufView.length; i++) {
          receivedData += String.fromCharCode(bufView[i]);
        }
        if(allDataSent) incrementProgress();
        // check if we got what we wanted
        var startProcess = receivedData.indexOf("< <<");
        var endProcess = receivedData.indexOf(">> >", startProcess);
        if(startProcess >= 0 && endProcess > 0){
          // All good - get the data!
          var result = receivedData.substring(startProcess + 4,endProcess);
          console.log("Got "+JSON.stringify(receivedData));
          // strip out the text we found
          receivedData = receivedData.substr(0,startProcess) + receivedData.substr(endProcess+4);
          // Now stop time timeout
          if (timeout) clearInterval(timeout);
          timeout = "cancelled";
          // Do the next stuff
          nextStep(result);
        } else if (startProcess >= 0) {
          // we got some data - so keep waiting...
          hadDataSinceTimeout = true;
        }
      });

      // when we're done...
      var nextStep = function(result) {
        Espruino.Core.Status.setStatus("");
        // start the previous reader listing again
        Espruino.Core.Serial.startListening(prevReader);
        // forward the original text to the previous reader
        if(prevReader) prevReader(receivedData);
        // run the callback
        callback(result);
      };

      var timeout = undefined;
      // Don't Ctrl-C, as we've already got ourselves a prompt with Espruino.Core.Utils.getEspruinoPrompt
      var cmd;
      if (exprPrintsResult)
        cmd  = '\x10print("<","<<");'+expressionToExecute+';print(">>",">")\n';
      else
        cmd  = '\x10print("<","<<",JSON.stringify('+expressionToExecute+'),">>",">")\n';

      Espruino.Core.Serial.write(cmd,
          undefined, function() {
            allDataSent = true;
            // now it's sent, wait for data
            var maxTimeout = 30; // seconds - how long we wait if we're getting data
            var minTimeout = 2; // seconds - how long we wait if we're not getting data
            var pollInterval = 500; // milliseconds
            var timeoutSeconds = 0;
            if (timeout != "cancelled") {
              timeout = setInterval(function onTimeout(){
                incrementProgress();
                timeoutSeconds += pollInterval/1000;
                // if we're still getting data, keep waiting for up to 10 secs
                if (hadDataSinceTimeout && timeoutSeconds<maxTimeout) {
                  hadDataSinceTimeout = false;
                } else if (timeoutSeconds > minTimeout) {
                  // No data yet...
                  // OR we keep getting data for > maxTimeout seconds
                  clearInterval(timeout);
                  console.warn("No result found for "+JSON.stringify(expressionToExecute)+" - just got "+JSON.stringify(receivedData));
                  nextStep(undefined);
                }
              }, pollInterval);
            }
          });
    }

    if(Espruino.Core.Serial.isConnected()){
      Espruino.Core.Utils.getEspruinoPrompt(function() {
        getProcessInfo(expressionToExecute, callback);
      });
    } else {
      console.error("executeExpression called when not connected!");
      callback(undefined);
    }
  };

  function versionToFloat(version) {
    return parseFloat(version.trim().replace("v","."));
  };

  /// Gets a URL, and returns callback(data) or callback(undefined) on error
  function getURL(url, callback) {
    Espruino.callProcessor("getURL", { url : url, data : undefined }, function(result) {
      if (result.data!==undefined) {
        callback(result.data);
      } else {
        var resultUrl = result.url ? result.url : url;
        if (typeof process === 'undefined') {
          // Web browser
          var xhr = new XMLHttpRequest();
          xhr.responseType = "text";
          xhr.addEventListener("load", function () {
            if (xhr.status === 200) {
              callback(xhr.response.toString());
            } else {
              console.error("getURL("+JSON.stringify(url)+") error : HTTP "+xhr.status);
              callback(undefined);
            }
          });
          xhr.addEventListener("error", function (e) {
            console.error("getURL("+JSON.stringify(url)+") error "+e);
            callback(undefined);
          });
          xhr.open("GET", url, true);
          xhr.send(null);
        } else {
          // Node.js
          if (resultUrl.substr(0,4)=="http") {
            var m = resultUrl[4]=="s"?"https":"http";

            var http_options = Espruino.Config.MODULE_PROXY_ENABLED ? {
              host: Espruino.Config.MODULE_PROXY_URL,
              port: Espruino.Config.MODULE_PROXY_PORT,
              path: resultUrl,
            } : resultUrl;

            require(m).get(http_options, function(res) {
              if (res.statusCode != 200) {
                console.log("Espruino.Core.Utils.getURL: got HTTP status code "+res.statusCode+" for "+url);
                return callback(undefined);
              }
              var data = "";
              res.on("data", function(d) { data += d; });
              res.on("end", function() {
                callback(data);
              });
            }).on('error', function(err) {
              console.error("getURL("+JSON.stringify(url)+") error : "+err);
              callback(undefined);
            });
          } else {
            require("fs").readFile(resultUrl, function(err, d) {
              if (err) {
                console.error(err);
                callback(undefined);
              } else
                callback(d.toString());
            });
          }
        }
      }
    });
  }

  /// Gets a URL as a Binary file, returning callback(err, ArrayBuffer)
  var getBinaryURL = function(url, callback) {
    console.log("Downloading "+url);
    Espruino.Core.Status.setStatus("Downloading binary...");
    var xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        Espruino.Core.Status.setStatus("Done.");
        var data = xhr.response;
        callback(undefined,data);
      } else
        callback("Error downloading file - HTTP "+xhr.status);
    });
    xhr.addEventListener("error", function () {
      callback("Error downloading file");
    });
    xhr.open("GET", url, true);
    xhr.send(null);
  };

  /// Gets a URL as JSON, and returns callback(data) or callback(undefined) on error
  function getJSONURL(url, callback) {
    getURL(url, function(d) {
      if (!d) return callback(d);
      var j;
      try { j=JSON.parse(d); } catch (e) { console.error("Unable to parse JSON",d); }
      callback(j);
    });
  }

  function isURL(text) {
    return (new RegExp( '(http|https)://' )).test(text);
  }

  /* Are we served from a secure location so we're
   forced to use a secure get? */
  function needsHTTPS() {
    if (typeof window==="undefined" || !window.location) return false;
    return window.location.protocol=="https:";
  }

  /* Open a file load dialog.
  options = {
   id :  ID is to ensure that subsequent calls with  the same ID remember the last used directory.
   type :
     type=="text" => (default) Callback is called with a string
     type=="arraybuffer" => Callback is called with an arraybuffer
   mimeType : (optional) comma-separated list of accepted mime types for files or extensions (eg. ".js,application/javascript")

   callback(contents, mimeType, fileName)
  */
  function fileOpenDialog(options, callback) {
    options = options||{};
    options.type = options.type||"text";
    options.id = options.id||"default";
    var loaderId = options.id+"FileLoader";
    var fileLoader = document.getElementById(loaderId);
    if (!fileLoader) {
      fileLoader = document.createElement("input");
      fileLoader.setAttribute("id", loaderId);
      fileLoader.setAttribute("type", "file");
      fileLoader.setAttribute("style", "z-index:-2000;position:absolute;top:0px;left:0px;");
      if (options.mimeType)
        fileLoader.setAttribute("accept",options.mimeType);
      fileLoader.addEventListener('click', function(e) {
        e.target.value = ''; // handle repeated upload of the same file
      });
      fileLoader.addEventListener('change', function(e) {
        if (!fileLoader.callback) return;
        var files = e.target.files;
        var file = files[0];
        var reader = new FileReader();
        reader.onload = function(e) {
          /* Doing reader.readAsText(file) interprets the file as UTF8
          which we don't want. */
          var result;
          if (options.type=="text") {
            var a = new Uint8Array(e.target.result);
            result = "";
            for (var i=0;i<a.length;i++)
              result += String.fromCharCode(a[i]);
          } else
            result = e.target.result;
          fileLoader.callback(result, file.type, file.name);
          fileLoader.callback = undefined;
        };
        if (options.type=="text" || options.type=="arraybuffer") reader.readAsArrayBuffer(file);
        else throw new Error("fileOpenDialog: unknown type "+options.type);
      }, false);
      document.body.appendChild(fileLoader);
    }
    fileLoader.callback = callback;
    fileLoader.click();
  }

  /* Save a file with a save file dialog. callback(savedFileName) only called in chrome app case when we knopw the filename*/
  function fileSaveDialog(data, filename, callback) {
    function errorHandler() {
      Espruino.Core.Notifications.error("Error Saving", true);
    }

    if (chrome.fileSystem) {
      // Chrome Web App / NW.js
      chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName:filename}, function(writableFileEntry) {
        if (!writableFileEntry) return; // cancelled
        writableFileEntry.createWriter(function(writer) {
          var blob = new Blob([data],{ type: "text/plain"} );
          writer.onerror = errorHandler;
          // when truncation has finished, write
          writer.onwriteend = function(e) {
            writer.onwriteend = function(e) {
              console.log('FileWriter: complete');
              if (callback) callback(writableFileEntry.name);
            };
            console.log('FileWriter: writing');
            writer.write(blob);
          };
          // truncate
          console.log('FileWriter: truncating');
          writer.truncate(blob.size);
        }, errorHandler);
      });
    } else {
      var rawdata = new Uint8Array(data.length);
      for (var i=0;i<data.length;i++) rawdata[i]=data.charCodeAt(i);
      var a = document.createElement("a"),
          file = new Blob([rawdata.buffer], {type: "text/plain"});
      var url = URL.createObjectURL(file);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  };

  /** Bluetooth device names that we KNOW run Espruino */
  function recognisedBluetoothDevices() {
    return [
      "Puck.js", "Pixl.js", "MDBT42Q", "Espruino", "Badge", "Thingy", "RuuviTag", "iTracker", "Smartibot", "Bangle.js",
    ];
  }

  /** If we can't find service info, add devices
   based only on their name */
  function isRecognisedBluetoothDevice(name) {
    if (!name) return false;
    var devs = recognisedBluetoothDevices();
    for (var i=0;i<devs.length;i++)
      if (name.substr(0, devs[i].length) == devs[i])
        return true;
    return false;
  }


  function getVersion(callback) {
    var xmlhttp = new XMLHttpRequest();
    var path = (window.location.pathname.indexOf("relay")>=0)?"../":"";
    xmlhttp.open('GET', path+'manifest.json');
    xmlhttp.onload = function (e) {
      var manifest = JSON.parse(xmlhttp.responseText);
      callback(manifest.version);
    };
    xmlhttp.send(null);
  }

  function getVersionInfo(callback) {
    getVersion(function(version) {
      var platform = "Web App";
      if (isNWApp())
        platform = "NW.js Native App";
      if (isChromeWebApp())
        platform = "Chrome App";

      callback(platform+", v"+version);
    });
  }

  // Converts a string to an ArrayBuffer
  function stringToArrayBuffer(str) {
    var buf=new Uint8Array(str.length);
    for (var i=0; i<str.length; i++) {
      var ch = str.charCodeAt(i);
      if (ch>=256) {
        console.warn("stringToArrayBuffer got non-8 bit character - code "+ch);
        ch = "?".charCodeAt(0);
      }
      buf[i] = ch;
    }
    return buf.buffer;
  };

  // Converts a string to a Buffer
  function stringToBuffer(str) {
    var buf = Buffer.alloc(str.length);
    for (var i = 0; i < buf.length; i++) {
      buf.writeUInt8(str.charCodeAt(i), i);
    }
    return buf;
  };

  // Converts a DataView to an ArrayBuffer
  function dataViewToArrayBuffer(str) {
    var bufView = new Uint8Array(dv.byteLength);
    for (var i = 0; i < bufView.length; i++) {
      bufView[i] = dv.getUint8(i);
    }
    return bufView.buffer;
  };

  // Converts an ArrayBuffer to a string
  function arrayBufferToString(str) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  };

  /* Parses a JSON string into JS, taking into account some of the issues
  with Espruino's JSON from 2v04 and before */
  function parseJSONish(str) {
    var lex = getLexer(str);
    var tok = lex.next();
    var final = "";
    while (tok!==undefined) {
      var s = tok.str;
      if (tok.type=="STRING") {
        s = s.replace(/\\([0-9])/g,"\\u000$1");
        s = s.replace(/\\x(..)/g,"\\u00$1");
      }
      final += s;
      tok = lex.next();
    }
    return JSON.parse(final);
  };

  // Does the given string contain only ASCII characters?
  function isASCII(str) {
    for (var i=0;i<str.length;i++) {
      var c = str.charCodeAt(i);
      if ((c<32 || c>126) &&
          (c!=10) && (c!=13) && (c!=9)) return false;
    }
    return true;
  }

  // btoa that works on utf8
  function btoa(input) {
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "";
    var i=0;
    while (i<input.length) {
      var octet_a = 0|input.charCodeAt(i++);
      var octet_b = 0;
      var octet_c = 0;
      var padding = 0;
      if (i<input.length) {
        octet_b = 0|input.charCodeAt(i++);
        if (i<input.length) {
          octet_c = 0|input.charCodeAt(i++);
          padding = 0;
        } else
          padding = 1;
      } else
        padding = 2;
      var triple = (octet_a << 0x10) + (octet_b << 0x08) + octet_c;
      out += b64[(triple >> 18) & 63] +
          b64[(triple >> 12) & 63] +
          ((padding>1)?'=':b64[(triple >> 6) & 63]) +
          ((padding>0)?'=':b64[triple & 63]);
    }
    return out;
  }

  Espruino.Core.Utils = {
    init : init,
    isWindows : isWindows,
    isAppleDevice : isAppleDevice,
    getChromeVersion : getChromeVersion,
    isNWApp : isNWApp,
    isChromeWebApp : isChromeWebApp,
    isProgressiveWebApp : isProgressiveWebApp,
    hasNativeTitleBar : hasNativeTitleBar,
    escapeHTML : escapeHTML,
    fixBrokenCode : fixBrokenCode,
    getSubString : getSubString,
    getLexer : getLexer,
    countBrackets : countBrackets,
    getEspruinoPrompt : getEspruinoPrompt,
    executeExpression : function(expr,callback) { executeExpression(expr,callback,false); },
    executeStatement : function(statement,callback) { executeExpression(statement,callback,true); },
    versionToFloat : versionToFloat,
    getURL : getURL,
    getBinaryURL : getBinaryURL,
    getJSONURL : getJSONURL,
    isURL : isURL,
    needsHTTPS : needsHTTPS,
    fileOpenDialog : fileOpenDialog,
    fileSaveDialog : fileSaveDialog,
    recognisedBluetoothDevices : recognisedBluetoothDevices,
    isRecognisedBluetoothDevice : isRecognisedBluetoothDevice,
    getVersion : getVersion,
    getVersionInfo : getVersionInfo,
    stringToArrayBuffer : stringToArrayBuffer,
    stringToBuffer : stringToBuffer,
    dataViewToArrayBuffer : dataViewToArrayBuffer,
    arrayBufferToString : arrayBufferToString,
    parseJSONish : parseJSONish,
    isASCII : isASCII,
    btoa : btoa
  };
}());



/* --------------------------------------------------------------
         EspruinoTools/core/codeWriter.js
   -------------------------------------------------------------- */
/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 The plugin that actually writes code out to Espruino
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  function init() {
    Espruino.Core.Config.add("RESET_BEFORE_SEND", {
      section : "Communications",
      name : "Reset before Send",
      description : "Reset Espruino before sending code from the editor pane?",
      type : "boolean",
      defaultValue : true
    });
    Espruino.Core.Config.add("STORE_LINE_NUMBERS", {
      section : "Communications",
      name : "Store line numbers",
      description : "Should Espruino store line numbers for each function? This uses one extra variable per function, but allows you to get source code debugging in the Web IDE",
      type : "boolean",
      defaultValue : true
    });

  }

  function writeToEspruino(code, callback) {
    /* hack around non-K&R code formatting that would have
    broken Espruino CLI's bracket counting */
    code = reformatCode(code);
    if (code === undefined) return; // it should already have errored

    // We want to make sure we've got a prompt before sending. If not,
    // this will issue a Ctrl+C
    Espruino.Core.Utils.getEspruinoPrompt(function() {
      // Make sure code ends in 2 newlines
      while (code[code.length-2]!="\n" || code[code.length-1]!="\n")
        code += "\n";

      // If we're supposed to reset Espruino before sending...
      if (Espruino.Config.RESET_BEFORE_SEND) {
        code = "\x10reset();\n"+code;
      }

      console.log("Sending... ", code);
      Espruino.Core.Serial.write(code, true, function() {

        // give 5 seconds for sending with save and 2 seconds without save
        var count = Espruino.Config.SAVE_ON_SEND ? 50 : 20;
        setTimeout(function cb() {
          if (Espruino.Core.Terminal!==undefined &&
              Espruino.Core.Terminal.getTerminalLine()!=">") {
            count--;
            if (count>0) {
              setTimeout(cb, 100);
            } else {
              // Espruino.Core.Notifications.error("Prompt not detected - upload failed. Trying to recover...");
              Espruino.Core.Serial.write("\x03\x03echo(1)\n", false, ()=>{if (callback) callback(false)});
            }
          } else {
            if (callback) callback(true);
          }
        }, 100);
      });
    });
  };

  /// Parse and fix issues like `if (false)\n foo` in the root scope
  function reformatCode(code) {
    var APPLY_LINE_NUMBERS = false;
    var lineNumberOffset = 0;
    var ENV = Espruino.Core.Env.getData();
    if (ENV && ENV.VERSION_MAJOR && ENV.VERSION_MINOR) {
      if (ENV.VERSION_MAJOR>1 ||
          ENV.VERSION_MINOR>=81.086) {
        if (Espruino.Config.STORE_LINE_NUMBERS)
          APPLY_LINE_NUMBERS = true;
      }
    }
    // Turn cr/lf into just lf (eg. windows -> unix)
    code = code.replace(/\r\n/g,"\n");
    // First off, try and fix funky characters
    for (var i=0;i<code.length;i++) {
      var ch = code.charCodeAt(i);
      if ((ch<32 || ch>255) && ch!=9/*Tab*/ && ch!=10/*LF*/ && ch!=13/*CR*/) {
        console.warn("Funky character code "+ch+" at position "+i+". Replacing with ?");
        code = code.substr(0,i)+"?"+code.substr(i+1);
      }
    }

    /* Search for lines added to the start of the code by the module handler.
    Ideally there would be a better way of doing this so line numbers stayed correct,
    but this hack works for now. Fixes EspruinoWebIDE#140 */
    if (APPLY_LINE_NUMBERS) {
      var l = code.split("\n");
      var i = 0;
      while (l[i] && (l[i].substr(0,8)=="Modules." ||
          l[i].substr(0,8)=="setTime(")) i++;
      lineNumberOffset = -i;
    }

    var resultCode = "\x10"; // 0x10 = echo off for line
    /** we're looking for:
     *   `a = \n b`
     *   `for (.....) \n X`
     *   `if (.....) \n X`
     *   `if (.....) { } \n else foo`
     *   `while (.....) \n X`
     *   `do \n X`
     *   `function (.....) \n X`
     *   `function N(.....) \n X`
     *   `var a \n , b`    `var a = 0 \n, b`
     *   `var a, \n b`     `var a = 0, \n b`
     *   `a \n . b`
     *   `foo() \n . b`
     *   `try { } \n catch \n () \n {}`
     *
     *   These are divided into two groups - where there are brackets
     *   after the keyword (statementBeforeBrackets) and where there aren't
     *   (statement)
     *
     *   We fix them by replacing \n with what you get when you press
     *   Alt+Enter (Ctrl + LF). This tells Espruino that it's a newline
     *   but NOT to execute.
     */
    var lex = Espruino.Core.Utils.getLexer(code);
    var brackets = 0;
    var curlyBrackets = 0;
    var statementBeforeBrackets = false;
    var statement = false;
    var varDeclaration = false;
    var lastIdx = 0;
    var lastTok = {str:""};
    var tok = lex.next();
    while (tok!==undefined) {
      var previousString = code.substring(lastIdx, tok.startIdx);
      var tokenString = code.substring(tok.startIdx, tok.endIdx);
      //console.log("prev "+JSON.stringify(previousString)+"   next "+tokenString);

      /* Inserting Alt-Enter newline, which adds newline without trying
      to execute */
      if (brackets>0 || // we have brackets - sending the alt-enter special newline means Espruino doesn't have to do a search itself - faster.
          statement || // statement was before brackets - expecting something else
          statementBeforeBrackets ||  // we have an 'if'/etc
          varDeclaration || // variable declaration then newline
          tok.str=="," || // comma on newline - there was probably something before
          tok.str=="." || // dot on newline - there was probably something before
          tok.str=="+" || tok.str=="-" || // +/- on newline - there was probably something before
          tok.str=="=" || // equals on newline - there was probably something before
          tok.str=="else" || // else on newline
          lastTok.str=="else" || // else befgore newline
          tok.str=="catch" || // catch on newline - part of try..catch
          lastTok.str=="catch"
      ) {
        //console.log("Possible"+JSON.stringify(previousString));
        previousString = previousString.replace(/\n/g, "\x1B\x0A");
      }

      var previousBrackets = brackets;
      if (tok.str=="(" || tok.str=="{" || tok.str=="[") brackets++;
      if (tok.str=="{") curlyBrackets++;
      if (tok.str==")" || tok.str=="}" || tok.str=="]") brackets--;
      if (tok.str=="}") curlyBrackets--;

      if (brackets==0) {
        if (tok.str=="for" || tok.str=="if" || tok.str=="while" || tok.str=="function" || tok.str=="throw") {
          statementBeforeBrackets = true;
          varDeclaration = false;
        } else if (tok.str=="var") {
          varDeclaration = true;
        } else if (tok.type=="ID" && lastTok.str=="function") {
          statementBeforeBrackets = true;
        } else if (tok.str=="try" || tok.str=="catch") {
          statementBeforeBrackets = true;
        } else if (tok.str==")" && statementBeforeBrackets) {
          statementBeforeBrackets = false;
          statement = true;
        } else if (["=","^","&&","||","+","+=","-","-=","*","*=","/","/=","%","%=","&","&=","|","|="].indexOf(tok.str)>=0) {
          statement = true;
        } else {
          if (tok.str==";") varDeclaration = false;
          statement = false;
          statementBeforeBrackets = false;
        }
      }
      /* If we're at root scope and had whitespace/comments between code,
      remove it all and replace it with a single newline and a
      0x10 (echo off for line) character. However DON'T do this if we had
      an alt-enter in the line, as it was there to stop us executing
      prematurely */
      if (previousBrackets==0 &&
          previousString.indexOf("\n")>=0 &&
          previousString.indexOf("\x1B\x0A")<0) {
        previousString = "\n\x10";
        // Apply line numbers to each new line sent, to aid debugger
        if (APPLY_LINE_NUMBERS && tok.lineNumber && (tok.lineNumber+lineNumberOffset)>0) {
          // Esc [ 1234 d
          // This is the 'set line number' command that we're abusing :)
          previousString += "\x1B\x5B"+(tok.lineNumber+lineNumberOffset)+"d";
        }
      }

      // add our stuff back together
      resultCode += previousString+tokenString;
      // next
      lastIdx = tok.endIdx;
      lastTok = tok;
      tok = lex.next();
    }
    //console.log(resultCode);
    if (brackets>0) {
      Espruino.Core.Notifications.error("You have more open brackets than close brackets. Please see the hints in the Editor window.");
      return undefined;
    }
    if (brackets<0) {
      Espruino.Core.Notifications.error("You have more close brackets than open brackets. Please see the hints in the Editor window.");
      return undefined;
    }
    return resultCode;
  };

  Espruino.Core.CodeWriter = {
    init : init,
    writeToEspruino : writeToEspruino,
  };
}());



/* --------------------------------------------------------------
         EspruinoTools/plugins/saveOnSend.js
   -------------------------------------------------------------- */
/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk),
 Victor Nakoryakov (victor@amperka.ru)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Wrap whole code in `onInit` function before send and save() it
 after upload. Wrapping is necessary to avoid execution start
 before save() is executed
 ------------------------------------------------------------------
 **/
"use strict";
(function() {

  function init() {
    Espruino.Core.Config.add("SAVE_ON_SEND", {
      section: "Communications",
      name: "Save on Send",
      descriptionHTML: 'How should code be uploaded? See <a href="http://www.espruino.com/Saving" target="_blank">espruino.com/Saving</a> for more information.<br>' + "<b>NOTE:</b> Avoid 'Direct to flash, even after <code>reset()</code>' for normal development - it can make it hard to recover if your code crashes the device.",
      type: {
        0: "To RAM (default) - execute code while uploading. Use 'save()' to save a RAM image to Flash",
        1: "Direct to Flash (execute code at boot)",
        2: "Direct to Flash (execute code at boot, even after 'reset()') - USE WITH CARE",
        3: "To Storage File (see 'File in Storage to send to')",
      },
      defaultValue: 0
    });
    Espruino.Core.Config.add("SAVE_STORAGE_FILE", {
      section: "Communications",
      name: "Send to File in Storage",
      descriptionHTML: "If <code>Save on Send</code> is set to <code>To Storage File</code>, this is the name of the file to write to.",
      type: "string",
      defaultValue: "myapp"
    });
    Espruino.Core.Config.add("LOAD_STORAGE_FILE", {
      section: "Communications",
      name: "Load after saving",
      descriptionHTML: "This applies only if saving to Flash (not RAM)",
      type: {
        0: "Don't load",
        1: "Load default application",
        2: "Load the Storage File just written to"
      },
      defaultValue: 2
    });
    Espruino.addProcessor("transformForEspruino", function(code, callback) {
      wrap(code, callback);
    });
  }

  function wrap(code, callback) {
    var isFlashPersistent = Espruino.Config.SAVE_ON_SEND == 2;
    var isStorageUpload = Espruino.Config.SAVE_ON_SEND == 3;
    var isFlashUpload = Espruino.Config.SAVE_ON_SEND == 1 || isFlashPersistent || isStorageUpload;
    if (!isFlashUpload)
      return callback(code);

    // Check environment vars
    var hasStorage = false;
    var ENV = Espruino.Core.Env.getData();
    if (ENV && ENV.VERSION_MAJOR && ENV.VERSION_MINOR !== undefined) {
      if (ENV.VERSION_MAJOR > 1 || ENV.VERSION_MINOR >= 96) {
        hasStorage = true;
      }
    }

    //
    console.log("Uploading " + code.length + " bytes to flash");
    if (!hasStorage) {
      // old style
      if (isStorageUpload) {
        Espruino.Core.Notifications.error("You have pre-1v96 firmware - unable to upload to Storage");
        code = "";
      } else {
        Espruino.Core.Notifications.error("You have pre-1v96 firmware. Upload size is limited by available RAM");
        code = "E.setBootCode(" + JSON.stringify(code) + (isFlashPersistent ? ",true" : "") + ");load()\n";
      }
    } else {
      // new style
      var filename;
      if (isStorageUpload)
        filename = Espruino.Config.SAVE_STORAGE_FILE;
      else
        filename = isFlashPersistent ? ".bootrst" : ".bootcde";
      if (!filename || filename.length > 28) {
        Espruino.Core.Notifications.error("Invalid Storage file name " + JSON.stringify(filename));
        code = "";
      } else {
        var CHUNKSIZE = 1024;
        var newCode = [];
        var len = code.length;
        newCode.push('require("Storage").write("' + filename + '",' + JSON.stringify(code.substr(0, CHUNKSIZE)) + ',0,' + len + ');');
        for (var i = CHUNKSIZE; i < len; i += CHUNKSIZE)
          newCode.push('require("Storage").write("' + filename + '",' + JSON.stringify(code.substr(i, CHUNKSIZE)) + ',' + i + ');');
        code = newCode.join("\n");
        if (Espruino.Config.LOAD_STORAGE_FILE == 2 && isStorageUpload)
          code += "\nload(" + JSON.stringify(filename) + ")\n";
        else if (Espruino.Config.LOAD_STORAGE_FILE != 0)
          code += "\nload()\n";
      }
    }
    callback(code);
  }

  Espruino.Plugins.SaveOnSend = {
    init: init,
  };
}());
/* --------------------------------------------------------------
         EspruinoTools/plugins/setTime.js
   -------------------------------------------------------------- */
/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Ability to set the current time in Espruino
 ------------------------------------------------------------------
 **/
"use strict";
(function() {

  function init() {
    Espruino.Core.Config.add("SET_TIME_ON_WRITE", {
      section: "Communications",
      name: "Set Current Time",
      description: "When sending code, set Espruino's clock to the current time",
      type: "boolean",
      defaultValue: true,
      onChange: function(newValue) {}
    });

    // When code is sent to Espruino, append code to set the current time
    Espruino.addProcessor("transformForEspruino", function(code, callback) {
      if (Espruino.Config.SET_TIME_ON_WRITE) {
        var time = new Date();
        code = "setTime(" + (time.getTime() / 1000) + ");E.setTimeZone(" + (-time.getTimezoneOffset() / 60) + ")\n" + code;
      }
      callback(code);
    });
  }

  Espruino.Plugins.SetTime = {
    init: init,
  };
}());


/* --------------------------------------------------------------
         EspruinoTools/plugins/minify.js
   -------------------------------------------------------------- */
/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Automatically minify code before it is sent to Espruino
 ------------------------------------------------------------------
 **/
"use strict";
(function() {

  var minifyUrl = "https://closure-compiler.appspot.com/compile";
  var minifyCache = [];

  function init() {
    Espruino.Core.Config.addSection("Minification", {
      sortOrder: 600,
      description: "Minification takes your JavaScript code and makes it smaller by removing comments and whitespace. " + "It can make your code execute faster and will save memory, but it will also make it harder to debug.\n" + "Esprima is a minifier built in to the Web IDE, so it can be used without an internet connection. " + "The Closure Compiler is an online service offered by Google. It produces more efficient code, but you need an internet connection to use it."
    });

    Espruino.Core.Config.add("MINIFICATION_LEVEL", {
      section: "Minification",
      name: "Minification",
      description: "Automatically minify code from the Editor window?",
      type: {
        "": "No Minification",
        "ESPRIMA": "Esprima (offline)",
        "WHITESPACE_ONLY": "Closure (online) - Whitespace Only",
        "SIMPLE_OPTIMIZATIONS": "Closure (online) - Simple Optimizations",
        "ADVANCED_OPTIMIZATIONS": "Closure (online) - Advanced Optimizations (not recommended)"
      },
      defaultValue: ""
    });
    Espruino.Core.Config.add("MODULE_MINIFICATION_LEVEL", {
      section: "Minification",
      name: "Module Minification",
      description: "Automatically minify modules? Only modules with a .js extension will be minified - if a file with a .min.js extension exists then it will be used instead.",
      type: {
        "": "No Minification",
        "ESPRIMA": "Esprima (offline)",
        "WHITESPACE_ONLY": "Closure (online) - Whitespace Only",
        "SIMPLE_OPTIMIZATIONS": "Closure (online) - Simple Optimizations",
        "ADVANCED_OPTIMIZATIONS": "Closure (online) - Advanced Optimizations (not recommended)"
      },
      defaultValue: "ESPRIMA"
    });

    Espruino.Core.Config.add("MINIFICATION_Mangle", {
      section: "Minification",
      name: "Esprima: Mangle",
      description: "Shorten variable names",
      type: "boolean",
      defaultValue: true
    });

    // When code is sent to Espruino, search it for modules and add extra code required to load them
    Espruino.addProcessor("transformForEspruino", function(code, callback) {
      minify(code, callback, Espruino.Config.MINIFICATION_LEVEL, false, "");
    });
    // When code is sent to Espruino, search it for modules and add extra code required to load them
    Espruino.addProcessor("transformModuleForEspruino", function(module, callback) {
      minify(module.code, function(code) {
        module.code = code;
        callback(module);
      }, Espruino.Config.MODULE_MINIFICATION_LEVEL, true, " in " + module.name);
    });
  }

  // Use the 'offline' Esprima compile
  function minifyCodeEsprima(code, callback, description) {
    if ((typeof esprima == "undefined") || (typeof esmangle == "undefined") || (typeof escodegen == "undefined")) {
      console.warn("esprima/esmangle/escodegen not defined - not minifying")
      return callback(code);
    }

    var code, syntax, option, str, before, after;
    var options = {};
    options["mangle"] = Espruino.Config.MINIFICATION_Mangle;
    option = {
      format: {
        renumber: true,
        hexadecimal: true,
        escapeless: true,
        indent: {
          style: ''
        },
        quotes: 'auto',
        compact: true,
        semicolons: false,
        parentheses: false
      }
    };
    str = '';
    try {
      before = code.length;
      syntax = esprima.parse(code, {
        raw: true,
        loc: true
      });
      syntax = obfuscate(syntax, options);
      code = escodegen.generate(syntax, option);
      after = code.length;
      if (before > after) {
        Espruino.Core.Notifications.info('No errors' + description + '. Minified ' + before + ' bytes to ' + after + ' bytes.');
      } else {
        Espruino.Core.Notifications.info('Can not minify further' + description + ', code is already optimized.');
      }
      callback(code);
    } catch (e) {
      Espruino.Core.Notifications.error(e.toString() + description);
      console.error(e.stack);
      callback(code);
    } finally {}
  }
  function obfuscate(syntax, options) {
    // hack for random changes between version we have included for Web IDE and node.js version
    if (typeof esmangle.require == "undefined")
      esmangle.require = esmangle.pass.require;
    syntax = esmangle.optimize(syntax, null, {
      destructive: true,
      directive: true,
      preserveCompletionValue: false,
      legacy: false,
      topLevelContext: false,
      inStrictCode: false
    });
    if (options.mangle)
      syntax = esmangle.mangle(syntax);
    return syntax;
  }

  // Use the 'online' Closure compiler
  function minifyCodeGoogle(code, callback, minificationLevel, description) {
    for (var i in minifyCache) {
      var item = minifyCache[i];
      if (item.code == code && item.level == minificationLevel) {
        console.log("Found code in minification cache - using that" + description);
        // move to front of cache
        minifyCache.splice(i, 1);
        // remove old
        minifyCache.push(item);
        // add at front
        // callback
        callback(item.minified);
        return;
      }
    }
    closureCompilerGoogle(code, minificationLevel, 'compiled_code', function(minified) {
      if (minified.trim() != "") {
        Espruino.Core.Notifications.info('No errors' + description + '. Minifying ' + code.length + ' bytes to ' + minified.length + ' bytes');
        if (minifyCache.length > 100)
          minifyCache = minifyCache.slice(-100);
        minifyCache.push({
          level: minificationLevel,
          code: code,
          minified: minified
        });
        callback(minified);
      } else {
        Espruino.Core.Notifications.warning("Errors while minifying" + description + " - sending unminified code.");
        callback(code);
        // get errors...
        closureCompilerGoogle(code, minificationLevel, 'errors', function(errors) {
          errors.split("\n").forEach(function(err) {
            if (err.trim() != "")
              Espruino.Core.Notifications.error(err.trim() + description);
          });
        });
      }
    });
  }
  function closureCompilerGoogle(code, minificationLevel, output_info, callback) {
    if (minificationLevel !== "") {
      var minifyObj = $.param({
        compilation_level: minificationLevel,
        output_format: "text",
        output_info: output_info,
        js_code: code,
        language: "ECMASCRIPT6",
        // so no need to mess with binary numbers now. \o/
        language_out: "ECMASCRIPT5"// ES6 output uses some now features now that Espruino doesn't like
      });
      $.post(minifyUrl, minifyObj, function(minifiedCode) {
        code = minifiedCode;
      }, "text").fail(function() {
        Espruino.Core.Notifications.error("HTTP error while minifying");
      }).done(function() {
        // ensure we call the callback even if minification failes
        callback(code);
      });
    }
  }

  function minify(code, callback, level, isModule, description) {
    (function() {
          Espruino.Core.Status.setStatus("Minifying" + (isModule ? description.substr(2) : ""));
          var _callback = callback;
          callback = function(code) {
            Espruino.Core.Status.setStatus("Minification complete");
            _callback(code);
          }
          ;
        }
    )();
    var minifyCode = code;
    var minifyCallback = callback;
    if (isModule) {
      /* if we're a module, we wrap this in a function so that unused constants
and functions can be removed */
      var header = "(function(){";
      var footer = "})();";
      minifyCode = header + code + footer;
      minifyCallback = function(minified) {
        callback(minified.substr(header.length, minified.length - (header.length + footer.length + 1)));
      }
    }

    switch (level) {
      case "WHITESPACE_ONLY":
      case "SIMPLE_OPTIMIZATIONS":
      case "ADVANCED_OPTIMIZATIONS":
        minifyCodeGoogle(code, callback, level, description);
        break;
      case "ESPRIMA":
        minifyCodeEsprima(code, callback, description);
        break;
      default:
        callback(code);
        break;
    }
  }

  Espruino.Plugins.Minify = {
    init: init,
  };
}());


// /* --------------------------------------------------------------
//          js/core/code.js
//    -------------------------------------------------------------- */
// /**
//  Copyright 2014 Gordon Williams (gw@pur3.co.uk)
//
//  This Source Code is subject to the terms of the Mozilla Public
//  License, v2.0. If a copy of the MPL was not distributed with this
//  file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
//  ------------------------------------------------------------------
//  Handling the getting and setting of code
//  ------------------------------------------------------------------
//  **/
// (function() {
//
//   var viewModeButton;
//
//   function init() {
//     // Configuration
//     Espruino.Core.Config.add("AUTO_SAVE_CODE", {
//       section: "Communications",
//       name: "Auto Save",
//       description: "Save code to local storage",
//       type: "boolean",
//       defaultValue: true,
//     });
//
//     // Setup code mode button
//     viewModeButton = Espruino.Core.App.addIcon({
//       id: "code",
//       icon: "code",
//       title: "Switch between Code and Graphical Designer",
//       order: 0,
//       area: {
//         name: "code",
//         position: "bottom"
//       },
//       click: function() {
//         if (isInBlockly()) {
//           switchToCode();
//           Espruino.Core.EditorJavaScript.madeVisible();
//         } else {
//           switchToBlockly();
//         }
//       }
//     });
//
//     // get code from our config area at bootup
//     Espruino.addProcessor("initialised", function(data, callback) {
//       var code;
//       if (Espruino.Config.AUTO_SAVE_CODE && typeof window !== 'undefined' && window.localStorage) {
//         code = window.localStorage.getItem("JSCODE");
//         console.log("Loaded code from local storage.");
//       }
//       if (!code) {
//         code = Espruino.Core.Code.DEFAULT_CODE;
//         console.log("No code in storage.");
//       }
//       Espruino.Core.EditorJavaScript.setCode(code);
//       callback(data);
//     });
//     Espruino.addProcessor("sending", function(data, callback) {
//       // save the code to local storage - not rate limited
//       if (Espruino.Config.AUTO_SAVE_CODE && typeof window !== 'undefined' && window.localStorage)
//         window.localStorage.setItem("JSCODE", Espruino.Core.EditorJavaScript.getCode());
//       callback(data);
//     });
//     Espruino.addProcessor("jsCodeChanged", function(data, callback) {
//       // save the code to local storage - not rate limited
//       if (Espruino.Config.AUTO_SAVE_CODE && typeof window !== 'undefined' && window.localStorage)
//         window.localStorage.setItem("JSCODE", data.code);
//       callback(data);
//     });
//   }
//
//   function isInBlockly() {
//     // TODO: we should really enumerate views - we might want another view?
//     return $("#divblockly").is(":visible");
//   }
//   ;
//   function switchToBlockly() {
//     $("#divcode").hide();
//     $("#divblockly").show();
//     viewModeButton.setIcon("block");
//     // Hack around issues Blockly have if we initialise when the window isn't visible
//     Espruino.Core.EditorBlockly.setVisible();
//   }
//
//   function switchToCode() {
//     $("#divblockly").hide();
//     $("#divcode").show();
//     viewModeButton.setIcon("code");
//   }
//
//   function getEspruinoCode(callback) {
//     Espruino.callProcessor("transformForEspruino", getCurrentCode(), callback);
//   }
//
//   function getCurrentCode() {
//     if (isInBlockly()) {
//       return Espruino.Core.EditorBlockly.getCode();
//     } else {
//       return Espruino.Core.EditorJavaScript.getCode();
//     }
//   }
//
//   function focus() {
//     if (isInBlockly()) {
//       document.querySelector("#divblockly").focus();
//     } else {
//       //document.querySelector(".CodeMirror").focus();
//       Espruino.Core.EditorJavaScript.getCodeMirror().focus()
//     }
//   }
//
//   Espruino.Core.Code = {
//     init: init,
//     getEspruinoCode: getEspruinoCode,
//     // get the currently selected bit of code ready to send to Espruino (including Modules)
//     getCurrentCode: getCurrentCode,
//     // get the currently selected bit of code (either blockly or javascript editor)
//     isInBlockly: isInBlockly,
//     switchToCode: switchToCode,
//     switchToBlockly: switchToBlockly,
//     focus: focus,
//     // give focus to the current code editor
//     DEFAULT_CODE: "var  on = false;\nsetInterval(function() {\n  on = !on;\n  LED1.write(on);\n}, 500);"
//   };
// }());


/* --------------------------------------------------------------
         EspruinoTools/core/flasher.js
   -------------------------------------------------------------- */
/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Actual low-level code for flashing Espruino Devices
 ------------------------------------------------------------------
 **/
"use strict";
(function() {

  var dataReceived = undefined;
  // listener for when data is received
  var bytesReceived = [];
  // list of characters for when no handler is specified

  var ACK = 0x79;
  var NACK = 0x1F;
  var DEFAULT_FLASH_OFFSET = 1024 * 10;
  /* Skip size of F1 bootloader by default */

  var setStatus = function() {};

  function init() {}

  var initialiseChip = function(callback, timeout) {
    setStatus("Initialising...");
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      clearInterval(iPoll);
      //callback("Can't find STM32 bootloader. Make sure the chip is reset with BOOT0=1 and BOOT1=0");
      callback("Can't find STM32 bootloader. Make sure the chip is reset into bootloader mode by holding down BTN1 while pressing RST");
    }, (timeout == undefined) ? 10000 : timeout);
    var iPoll = setInterval(function() {
      console.log("Sending... 0x7F");
      Espruino.Core.Serial.write("\x7f", false);
    }, 70);
    dataReceived = function(c) {
      console.log("got " + c);
      if (c == ACK || c == NACK) {
        clearTimeout(iTimeout);
        clearInterval(iPoll);
        setStatus("Initialised.");
        // wait for random extra data...
        dataReceived = function(c) {
          console.log("Already ACKed but got " + c);
        }
        ;
        setTimeout(function() {
          dataReceived = undefined;
          // finally call callback
          bodgeClock(callback);
        }, 500);
      }
    }
    ;
  };

  var waitForACK = function(callback, timeout) {
    var ms = timeout ? timeout : 1000;
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      callback("Timeout waiting for ACK - " + ms + "ms");
    }, ms);
    dataReceived = function(c) {
      //console.log("Got data "+JSON.stringify(c));
      dataReceived = undefined;
      if (c == ACK) {
        clearTimeout(iTimeout);
        callback(undefined);
      } else
        callback("Expected ACK but got " + c);
    }
    ;
  };

  var sendData = function(data, callback, timeout) {
    var s = "";
    var chksum = 0;
    for (var i in data) {
      chksum = chksum ^ data[i];
      s += String.fromCharCode(data[i]);
    }
    Espruino.Core.Serial.write(s + String.fromCharCode(chksum), false);
    /* wait for ACK *NOW* - not in the write callback, as by that time we
may have already received the ACK we were looking for */
    waitForACK(callback, timeout);
  };

  var receiveData = function(count, callback, timeout) {
    var data = new Uint8Array(count);
    var dataCount = 0;
    var iTimeout = setTimeout(function() {
      dataReceived = undefined;
      callback("Timeout reading " + count + " bytes");
    }, timeout ? timeout : 2000);
    dataReceived = function(c) {
      data[dataCount++] = c;
      if (dataCount == count) {
        clearTimeout(iTimeout);
        dataReceived = undefined;
        callback(undefined, data);
      }
    }
    ;
  };

  var sendCommand = function(command, callback) {
    Espruino.Core.Serial.write(String.fromCharCode(command) + String.fromCharCode(0xFF ^ command), false);
    /* wait for ACK *NOW* - not in the write callback, as by that time we
may have already received the ACK we were looking for */
    waitForACK(callback);
  };

  var eraseChip = function(callback) {
    Espruino.Core.Status.setStatus("Erasing...");
    // Extended erase
    sendCommand(0x44, function(err) {
      if (err) {
        callback(err);
        return;
      }
      console.log("We may be some time...");
      sendData([0xFF, 0xFF], function(err) {
            if (err) {
              callback(err);
              return;
            }
            callback(undefined);
          }, 20000 /*timeout*/
      );
    });
  };

  var readData = function(callback, addr, readBytes) {
    console.log("Reading " + readBytes + " bytes from 0x" + addr.toString(16) + "...");
    // send read command
    sendCommand(0x11, function(err) {
      if (err) {
        console.log("Error sending command (" + err + ").");
        callback(err);
        return;
      }
      // send address
      sendData([(addr >> 24) & 0xFF, (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF], function(err) {
        if (err) {
          console.log("Error sending address. (" + err + ")");
          callback(err);
          return;
        }
        // send amount of bytes we want
        sendData([readBytes - 1], function(err) {
              if (err) {
                console.log("Error while reading. (" + err + ")");
                callback(err);
                return;
              }
              receiveData(readBytes, /*function(err) {
            if (err) {
              console.log("Error while reading. retrying...");
              initialiseChip(function (err) {
                if (err) callback(err);
                else readData(callback, addr, readBytes);
              }, 10000);
              return;
            }
            callback(undefined, data);
          }*/
                  callback, 1000);
            }, 2000 /*timeout*/
        );
      });
    });
  };

  var bodgeClock = function(callback) {
    /* 1v43 bootloader ran APB1 at 9Mhz, which isn't enough for
some STM32 silicon, which has a bug. Instead, set the APB1 clock
using the bootloader write command, which will fix it up enough for
flashing.   */
    var RCC_CFGR = 0x40021004;
    readData(function(err, data) {
      if (err)
        return callback(err);
      var word = (data[3] << 24) | (data[2] << 16) | (data[1] << 8) | data[0];
      console.log("RCC->CFGR = " + word);
      var newword = (word & 0xFFFFF8FF) | 0x00000400;
      if (newword == word) {
        console.log("RCC->CFGR is correct");
        callback(undefined);
      } else {
        console.log("Setting RCC->CFGR to " + newword);
        writeData(callback, RCC_CFGR, [newword & 0xFF, (newword >> 8) & 0xFF, (newword >> 16) & 0xFF, (newword >> 24) & 0xFF]);
      }
    }, RCC_CFGR, 4);
  };

  var writeData = function(callback, addr, data) {
    if (data.length > 256)
      callback("Writing too much data");
    console.log("Writing " + data.length + " bytes at 0x" + addr.toString(16) + "...");
    // send write command
    sendCommand(0x31, function(err) {
      if (err) {
        console.log("Error sending command (" + err + "). retrying...");
        initialiseChip(function(err) {
          if (err)
            callback(err);
          else
            writeData(callback, addr, data);
        }, 30000);
        return;
      }
      // send address
      sendData([(addr >> 24) & 0xFF, (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF], function(err) {
        if (err) {
          console.log("Error sending address (" + err + "). retrying...");
          initialiseChip(function(err) {
            if (err)
              callback(err);
            else
              writeData(callback, addr, data);
          }, 30000);
          return;
        }
        // work out data to send
        var sData = [data.length - 1];
        // for (var i in data) doesn't just do 0..data.length-1 in node!
        for (var i = 0; i < data.length; i++)
          sData.push(data[i] & 0xFF);
        // send data
        sendData(sData, function(err) {
              if (err) {
                console.log("Error while writing (" + err + "). retrying...");
                initialiseChip(function(err) {
                  if (err)
                    callback(err);
                  else
                    writeData(callback, addr, data);
                }, 30000);
                return;
              }
              callback(undefined);
              // done
            }, 2000 /*timeout*/
        );
      });
    });
  };

  var writeAllData = function(binary, flashOffset, callback) {
    var chunkSize = 256;
    console.log("Writing " + binary.byteLength + " bytes");
    Espruino.Core.Status.setStatus("Writing flash...", binary.byteLength);
    var writer = function(offset) {
      if (offset >= binary.byteLength) {
        Espruino.Core.Status.setStatus("Write complete!");
        callback(undefined);
        // done
        return;
      }
      var len = binary.byteLength - offset;
      if (len > chunkSize)
        len = chunkSize;
      var data = new Uint8Array(binary,offset,len);
      writeData(function(err) {
        if (err) {
          callback(err);
          return;
        }
        Espruino.Core.Status.incrementProgress(chunkSize);
        writer(offset + chunkSize);
      }, 0x08000000 + offset, data);
    };
    writer(flashOffset);
  };

  var readAllData = function(binaryLength, flashOffset, callback) {
    var data = new Uint8Array(flashOffset);
    var chunkSize = 256;
    console.log("Reading " + binaryLength + " bytes");
    Espruino.Core.Status.setStatus("Reading flash...", binaryLength);
    var reader = function(offset) {
      if (offset >= binaryLength) {
        Espruino.Core.Status.setStatus("Read complete!");
        callback(undefined, data);
        // done
        return;
      }
      var len = binaryLength - offset;
      if (len > chunkSize)
        len = chunkSize;
      readData(function(err, dataChunk) {
        if (err) {
          callback(err);
          return;
        }
        for (var i in dataChunk)
          data[offset + i] = dataChunk[i];
        Espruino.Core.Status.incrementProgress(chunkSize);
        reader(offset + chunkSize);
      }, 0x08000000 + offset, chunkSize);
    };
    reader(flashOffset);
  };

  function flashBinaryToDevice(binary, flashOffset, callback, statusCallback) {
    setStatus = function(x) {
      if (!Espruino.Core.Status.hasProgress())
        Espruino.Core.Status.setStatus(x);
      if (statusCallback)
        statusCallback(x);
    }
    if (typeof flashOffset === 'function') {
      // backward compatibility if flashOffset is missed
      callback = flashOffset;
      flashOffset = null;
    }

    if (!flashOffset && flashOffset !== 0) {
      flashOffset = DEFAULT_FLASH_OFFSET;
    }

    if (typeof binary == "string") {
      var buf = new ArrayBuffer(binary.length);
      var a = new Uint8Array(buf);
      for (var i = 0; i < binary.length; i++)
        a[i] = binary.charCodeAt(i);
      binary = buf;
    }
    // add serial listener
    dataReceived = undefined;
    Espruino.Core.Serial.startListening(function(readData) {
      var bufView = new Uint8Array(readData);
      //console.log("Got "+bufView.length+" bytes");
      for (var i = 0; i < bufView.length; i++)
        bytesReceived.push(bufView[i]);
      if (dataReceived !== undefined) {
        for (var i = 0; i < bytesReceived.length; i++) {
          if (dataReceived === undefined)
            console.log("OH NO!");
          dataReceived(bytesReceived[i]);
        }
        bytesReceived = [];
      }
    });
    Espruino.Core.Serial.setBinary(true);
    var hadSlowWrite = Espruino.Core.Serial.isSlowWrite();
    Espruino.Core.Serial.setSlowWrite(false, true /*force*/
    );
    var oldHandler;
    if (Espruino.Core.Terminal) {
      oldHandler = Espruino.Core.Terminal.setInputDataHandler(function() {// ignore keyPress from terminal during flashing
      });
    }
    var finish = function(err) {
      Espruino.Core.Serial.setSlowWrite(hadSlowWrite);
      Espruino.Core.Serial.setBinary(false);
      if (Espruino.Core.Terminal)
        Espruino.Core.Terminal.setInputDataHandler(oldHandler);
      callback(err);
    };
    // initialise
    initialiseChip(function(err) {
      if (err) {
        finish(err);
        return;
      }
      setStatus("Erasing...");
      eraseChip(function(err) {
        if (err) {
          finish(err);
          return;
        }
        setStatus("Writing Firmware...");
        writeAllData(binary, flashOffset, function(err) {
          if (err) {
            finish(err);
            return;
          }
          finish();
        });
      });
      /*readAllData(binary.byteLength, function(err,chipData) {
  if (err) {
    finish(err);
    return;
  }
  var errors = 0;
  var needsErase = false;
  var binaryData = new Uint8Array(binary, 0, binary.byteLength);
  for (var i=FLASH_OFFSET;i<binary.byteLength;i++) {
    if (binaryData[i]!=chipData[i]) {
      if (chipData[i]!=0xFF) needsErase = true;
      console.log(binaryData[i]+" vs "+data[i]);
      errors++;
    }
  }
  console.log(errors+" differences, "+(needsErase?"needs erase":"doesn't need erase"));
});*/
    });
  }

  function flashDevice(url, flashOffset, callback, statusCallback) {
    Espruino.Core.Utils.getBinaryURL(url, function(err, binary) {
      if (err) {
        callback(err);
        return;
      }
      console.log("Downloaded " + binary.byteLength + " bytes");
      flashBinaryToDevice(binary, flashOffset, callback, statusCallback);
    });
  }
  ;
  function resetDevice(callback) {
    // add serial listener
    dataReceived = undefined;
    Espruino.Core.Serial.startListening(function(readData) {
      var bufView = new Uint8Array(readData);
      //console.log("Got "+bufView.length+" bytes");
      for (var i = 0; i < bufView.length; i++)
        bytesReceived.push(bufView[i]);
      if (dataReceived !== undefined) {
        for (var i = 0; i < bytesReceived.length; i++) {
          if (dataReceived === undefined)
            console.log("OH NO!");
          dataReceived(bytesReceived[i]);
        }
        bytesReceived = [];
      }
    });
    Espruino.Core.Serial.setBinary(true);
    var hadSlowWrite = Espruino.Core.Serial.isSlowWrite();
    Espruino.Core.Serial.setSlowWrite(false, true /*force*/
    );
    var oldHandler = Espruino.Core.Terminal.setInputDataHandler(function() {// ignore keyPress from terminal during flashing
    });
    var finish = function(err) {
      Espruino.Core.Serial.setSlowWrite(hadSlowWrite);
      Espruino.Core.Serial.setBinary(false);
      Espruino.Core.Terminal.setInputDataHandler(oldHandler);
      callback(err);
    };
    // initialise
    initialiseChip(function(err) {
      if (err)
        return finish(err);
      var data = new Uint8Array([0x04, 0x00, 0xFA, 0x05]);
      var addr = 0xE000ED0C;
      console.log("Writing " + data.length + " bytes at 0x" + addr.toString(16) + "...");
      // send write command
      sendCommand(0x31, function(err) {
        if (err)
          return finish(err);
        // send address
        sendData([(addr >> 24) & 0xFF, (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF], function(err) {
              if (err)
                return finish(err);
              // work out data to send
              // for (var i in data) doesn't just do 0..data.length-1 in node!
              for (var i = 0; i < data.length; i++)
                sData.push(data[i] & 0xFF);
              var s = "";
              var chksum = 0;
              for (var i in sData) {
                chksum = chksum ^ sData[i];
                s += String.fromCharCode(sData[i]);
              }
              Espruino.Core.Serial.write(s + String.fromCharCode(chksum), false, finish);
            }, 2000 /*timeout*/
        );
      });
    });
  }
  ;
  Espruino.Core.Flasher = {
    init: init,
    flashDevice: flashDevice,
    flashBinaryToDevice: flashBinaryToDevice,
    resetDevice: resetDevice
  };
}());



/* --------------------------------------------------------------
         EspruinoTools/plugins/unicode.js
   -------------------------------------------------------------- */
/**
 Copyright 2015 Gordon Williams (gw@pur3.co.uk),
 Victor Nakoryakov (victor@amperka.ru)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 ------------------------------------------------------------------
 Escape non-ASCII characters into \xHH UTF-8 sequences before send
 ------------------------------------------------------------------
 **/
"use strict";
(function(){

  // Node.js doesn't have utf8 installed
  var utf8lib;
  if ("undefined"==typeof utf8) {
    if ("undefined"!=typeof require) {
      // console.log("Loading UTF8 with require");
      utf8lib = require('utf8');
    } else {
      // console.log("WARNING: Loading placeholder UTF8");
      utf8lib = { encode : function(c){return c} };
    }
  } else {
    // console.log("UTF8 Library loaded successfully");
    utf8lib = utf8;
  }

  function init() {
    Espruino.addProcessor("transformForEspruino", function(code, callback) {
      escapeUnicode(code, callback);
    });
  }

  function escapeUnicode(code, callback) {
    // Only correct unicode inside strings
    var newCode = "";
    var lex = Espruino.Core.Utils.getLexer(code);
    var lastIdx = 0;
    var tok = lex.next();
    while (tok!==undefined) {
      var previousString = code.substring(lastIdx, tok.startIdx);
      var tokenString = code.substring(tok.startIdx, tok.endIdx);
      if (tok.type=="STRING") {
        var newTokenString = "";
        for (var i=0;i<tokenString.length;i++) {
          var ch = tokenString.charCodeAt(i);
          if (ch >= 255)
            newTokenString += escapeChar(tokenString[i]);
          else
            newTokenString += tokenString[i];
        }
        tokenString = newTokenString;
      }
      newCode += previousString+tokenString;
      // next
      lastIdx = tok.endIdx;
      tok = lex.next();
    }
    newCode += code.substring(lastIdx);
    callback(newCode);
  }

  function escapeChar(c) {
    // encode char into UTF-8 sequence in form of \xHH codes
    var result = '';
    utf8lib.encode(c).split('').forEach(function(c) {
      var code = c.charCodeAt(0) & 0xFF;
      result += "\\x";
      if (code < 0x10) result += '0';
      result += code.toString(16).toUpperCase();
    });

    return result;
  }

  Espruino.Plugins.Unicode = {
    init : init,
  };
}());
