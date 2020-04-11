var Printer = new Vue({
    el: "#Printer",
    data: {
        encoder: new TextEncoder('utf-8'),
        decoder: new TextDecoder('utf-8'),
        connecting: false,
        connected: false,
        f:0,
        s:0,
        files: [],
        filecache: [],
        transmit: null,
        recvr: null,
        recvBuffer: "",
        online: false,
        status: "disconnected",
        showAdvanced: false,
        showFiles: false,
    },
    computed: {
        color: function(){
            switch(this.status){
                case "printing":        return "red"; break;
                case "paused":          return "blue"; break;
                case "standby":         return "green"; break;
                case "connecting":      return "purple"; break;
                case "default":         return "black"; break;
                case "no sd card":      return "cyan"; break;
            }
        },
        percent: function(){return parseInt(this.s>0 ? this.f/this.s*100 : 0)}
    },
    methods: {
        start:          function(event){this.send("Start Printing;")},
        stop:           function(event){this.send("Stop Printing;")},
        clean:          function(event){this.send("Clean;")},
        display:        function(event){this.send("Display;")},
        emergency:      function(event){this.send("Emergency;")},
        fReturn:        function(event){this.send("Return;")},
        pause:          function(event){ if (this.status=="paused")this.send("Keep Printing;"); if (this.status=="printing")this.send("Pause Printing;")},
        send:           function(message) {this.transmit.writeValue(this.encoder.encode(message));console.log("SEND:"+message)},
        setFile:        function(file) {this.send("file-"+file); this.showFiles = false;},
        connect: function(event) {
            navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'
                                , '0000ffe5-0000-1000-8000-00805f9b34fb']
            }).then(device => {
                this.status = "connecting"
                this.connecting=true;
                return device.gatt.connect();
            }).catch((error)=>{
                console.log(error)
            }).then(server =>{return server.getPrimaryServices();
            }).then(services => {
                services[1].getCharacteristic("0000ffe4-0000-1000-8000-00805f9b34fb").then(characteristic =>{
                    this.recvr = characteristic
                    this.recvr.addEventListener("characteristicvaluechanged", this.handleIncomingMessages);
                    this.recvr.startNotifications();
                });
                services[0].getCharacteristic("0000ffe9-0000-1000-8000-00805f9b34fb").then(characteristic =>{ 
                    this.transmit = characteristic 
                    this.connected=true;
                }).then(()=>{this.send("scan-file")})
            })
        },
        flushFiles: function(){
            this.files = this.filecache;
            this.filecache = [];
        },
        handleIncomingMessages: function(event) {
            let message = this.decoder.decode(event.target.value)
            if (message.slice(-1)=="\n") {
                let messages = (this.recvBuffer + message).split("\n")
                this.recvBuffer = ""
                for (let i in messages) {
                    let m = messages[i]
                    if (m.includes("pf_")) {
                        if (m.length>3)
                            this.fileName = m.split('_')[1]
                    }
                    else if (m.includes("F/S=")) {
                        var fs = m.split("=")[1].split("/")
                        this.f = parseInt(fs[0])
                        this.s = parseInt(fs[1])
                    }
                    else if (m.includes("P-")) {this.send("PWD-OK\n")}
                    else if (m.includes("f-")) {
                        let file = m.split("-")[1]
                        let part = file.split(".")
                        let fileObj = {id: part[2], name: part[0]+"."+part[1]}
                        this.filecache.push(fileObj)
                    }
                    else {
                        switch (m){
                            case "online":       this.online = true; break;
                            case "":             break;
                            case "scan-finish":  this.flushFiles();break;
                            case "standby_sts":  this.send("scan-file");
                                                 this.status = "standby";   break;
                            case "printing_sts": this.status = "printing";  break;
                            case "pause_sts":    this.status = "paused";    break;
                            case "pause-over":   this.status = "printing";  break;
                            case "stop_sts":     this.status = "stopped";   break;
                            case "printo_sts":   this.status = "print over";break;
                            case "nocard_sts":   this.status = "no sd card";break;
                            case "update_sts":   this.status = "updating";  break;
                            default: console.log("RECV:"+m); break;
                        }
                    }                        
                }
            }
            else this.recvBuffer += message;
        }
    }
});