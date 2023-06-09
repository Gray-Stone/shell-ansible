const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const Logger = Me.imports.logger.Logger;

const UDisksDriveProxy = Gio.DBusProxy.makeProxyWrapper(
  '<node>\
    <interface name="org.freedesktop.UDisks2.Drive">\
      <property type="s" name="Model" access="read"/>\
    </interface>\
  </node>'
);

const UDisksDriveAtaProxy = Gio.DBusProxy.makeProxyWrapper(
  '<node>\
    <interface name="org.freedesktop.UDisks2.Drive.Ata">\
      <property type="d" name="SmartTemperature" access="read"/>\
    </interface>\
  </node>'
);

function detectSensors() {
  // Logger.debug('Attempting to find sensors in path...');
  const sensorsProg = GLib.find_program_in_path('sensors');
  if (typeof sensorsProg !== 'undefined') {
    // Logger.debug('Found sensors at ' + sensorsProg);
  } else {
    Logger.error('Program sensors not found!');
  }
  return typeof sensorsProg !== 'undefined' ? [sensorsProg] : undefined;
}

function detectHDDTemp() {
  const hddtempArgv = GLib.find_program_in_path('hddtemp');
  if(hddtempArgv) {
    // check if this user can run hddtemp directly.
    if(!GLib.spawn_command_line_sync(hddtempArgv)[3])
      return [hddtempArgv];
  }
  // doesn't seem to be the case… is it running as a daemon?
  // Check first for systemd
  const systemctl = GLib.find_program_in_path('systemctl');
  const pidof = GLib.find_program_in_path('pidof');
  const nc = GLib.find_program_in_path('nc');
  let pid = undefined;

  if(systemctl) {
    const activeState = GLib.spawn_command_line_sync(systemctl + " show hddtemp.service -p ActiveState")[1].toString().trim();
    if(activeState == "ActiveState=active") {
      const output = GLib.spawn_command_line_sync(systemctl + " show hddtemp.service -p MainPID")[1].toString().trim();

      if(output.length && output.split("=").length == 2) {
        pid = Number(output.split("=")[1].trim());
      }
    }
  }

  // systemd isn't used on this system, try sysvinit instead
  if(!pid && pidof) {
    const output = GLib.spawn_command_line_sync("pidof hddtemp")[1].toString().trim();

    if(output.length) {
      pid = Number(output.trim());
    }
  }

  if(nc && pid)
  {
    // get daemon command line
    const cmdline = GLib.file_get_contents('/proc/'+pid+'/cmdline');
    // get port or assume default
    const match = /(-p\W*|--port=)(\d{1,5})/.exec(cmdline);
    const port = match ? parseInt(match[2]) : 7634;
    // use net cat to get data
    return [nc, 'localhost', port.toString()];
  }

  // not found
  return undefined;
}

function parseSensorsOutput(txt,parser) {
  const sensorsOutput = txt.split("\n");
  let featureLabel = undefined;
  let featureValue = undefined;
  const sensors = new Array();
  //iterate through each lines
  for(let i = 0; i < sensorsOutput.length; i++){
    // ignore chipset driver name and 'Adapter:' line for now
    i += 2;
    // get every feature of the chip
    while(typeof sensorsOutput[i] !== 'undefined') {
      // if it is not a continutation of a feature line
      if(sensorsOutput[i].indexOf(' ') != 0) {
        let feature = parser(featureLabel, featureValue);
        if (feature){
          sensors.push(feature);
          feature = undefined;
        }
        [featureLabel, featureValue] = sensorsOutput[i].split(':');
      }
      else {
        featureValue += sensorsOutput[i];
      }
      i++;
    }
  }
  let feature = parser(featureLabel, featureValue);
  if (feature) {
    sensors.push(feature);
    feature = undefined;
  }
  return sensors;
}

function parseSensorsTemperatureLine(label, value) {
  let sensor = undefined;
  if(label != undefined && value != undefined) {
    const curValue = value.trim().split('  ')[0];
    // does the current value look like a temperature unit (°C)?
    if(curValue.indexOf("C", curValue.length - "C".length) !== -1){
      sensor = new Array();
      let r;
      sensor['label'] = label.trim();
      sensor['temp'] = parseFloat(curValue.split(' ')[0]);
      sensor['low']  = (r = /low=\+(\d{1,3}.\d)/.exec(value))  ? parseFloat(r[1]) : undefined;
      sensor['high'] = (r = /high=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
      sensor['crit'] = (r = /crit=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
      sensor['hyst'] = (r = /hyst=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
    }
  }
  return sensor;
}

function parseFanRPMLine(label, value) {
  let sensor = undefined;
  if(label != undefined && value != undefined) {
    const curValue = value.trim().split('  ')[0];
    // does the current value look like a fan rpm line?
    if(curValue.indexOf("RPM", curValue.length - "RPM".length) !== -1){
      sensor = new Array();
      let r;
      sensor['label'] = label.trim();
      sensor['rpm'] = parseFloat(curValue.split(' ')[0]);
      sensor['min'] = (r = /min=(\d{1,5})/.exec(value)) ? parseFloat(r[1]) : undefined;
    }
  }
  return sensor;
}

function parseVoltageLine(label, value) {
  let sensor = undefined;
  if(label != undefined && value != undefined) {
    const curValue = value.trim().split('  ')[0];
    // does the current value look like a voltage line?
    if(curValue.indexOf("V", curValue.length - "V".length) !== -1){
      sensor = new Array();
      let r;
      sensor['label'] = label.trim();
      sensor['volt'] = parseFloat(curValue.split(' ')[0]);
      sensor['min'] = (r = /min=(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
      sensor['max'] = (r = /max=(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
    }
  }
  return sensor;
}

function parseHddTempOutput(txt, sep) {
  let hddtempOutput = [];
  if (txt.indexOf((sep+sep), txt.length - (sep+sep).length) >= 0) {
    hddtempOutput = txt.split(sep+sep);
  } else {
    hddtempOutput = txt.split("\n");
  }

  hddtempOutput = hddtempOutput.filter(function(e){ return e; });

  const sensors = new Array();
  for (const line of hddtempOutput) {
    const sensor = new Array();
    const fields = line.split(sep).filter(function(e){ return e; });
    sensor['label'] = _("Drive %s").format(fields[0].split('/').pop());
    sensor['temp'] = parseFloat(fields[2]);
    //push only if the temp is a Number
    if (!isNaN(sensor['temp']))
      sensors.push(sensor);
  }
  return sensors;
}

function filterTemperature(tempInfo) {
  return tempInfo['temp'] > 0 && tempInfo['temp'] < 115;
}

function filterFan(fanInfo) {
  return fanInfo['rpm'] > 0;
}

function filterVoltage(voltageInfo) {
  return true;
}

var Future = new Lang.Class({
  Name: 'Future',

  _init: function(argv, callback) {
    try {
      this._callback = callback;
      const [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
        null, /* cwd */
        argv, /* args */
        null, /* env */
        GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null /* child_setup */
      );
      this._stdout = new Gio.UnixInputStream({ fd: stdout, close_fd: true });
      this._dataStdout = new Gio.DataInputStream({ base_stream: this._stdout });
      this._stderr = new Gio.UnixInputStream({ fd: stderr, close_fd: true });
      new Gio.UnixOutputStream({ fd: stdin, close_fd: true }).close(null);

      this._childWatch = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, function(pid, status, requestObj) {
        GLib.source_remove(this._childWatch);
      }));

      this._readStdout();
    } catch(e) {
      Logger.error('Future _init: ' + e.toString());
    }
  },

  _readStdout: function(){
    this._dataStdout.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {
      if (stream.fill_finish(result) == 0){
        try {
          if (stream.peek_buffer() instanceof Uint8Array) {
            // Logger.debug('Using ByteArray.toString()')
            this._callback(ByteArray.toString(stream.peek_buffer()));
          } else {
            // Logger.debug('Using #toString()')
            this._callback(stream.peek_buffer().toString());
          }
        } catch(e) {
          Logger.error('Future _readStdout: ' + e.toString());
        }
        this._stdout.close(null);
        this._stderr.close(null);
        return;
      }

      stream.set_buffer_size(2 * stream.get_buffer_size());
      this._readStdout();
    }));
  }
});

// Poor man's async.js
const Async = {
  // mapping will be done in parallel
  map: function(arr, mapClb /* function(in, successClb)) */, resClb /* function(result) */) {
    let counter = arr.length;
    const result = [];
    for (let i = 0; i < arr.length; ++i) {
      mapClb(arr[i], (function(i, newVal) {
        result[i] = newVal;
        if (--counter == 0) resClb(result);
      }).bind(null, i)); // i needs to be bound since it will be changed during the next iteration
    }
  }
};

// routines for handling of udisks2
var UDisks = {
  // creates a list of sensor objects from the list of proxies given
  createListFromProxies: function(proxies) {
    return proxies.filter(function(proxy) {
      // 0K means no data available
      return proxy.ata.SmartTemperature > 0;
    }).map(function(proxy) {
      return {
        label: proxy.drive.Model,
        temp: proxy.ata.SmartTemperature - 272.15
      };
    });
  },

  // calls callback with [{ drive: UDisksDriveProxy, ata: UDisksDriveAtaProxy }, ... ] for every drive that implements both interfaces
  getDriveAtaProxies: function(callback) {
    Gio.DBusObjectManagerClient.new(Gio.DBus.system, 0, "org.freedesktop.UDisks2", "/org/freedesktop/UDisks2", null, null, function(src, res) {
      try {
        const objMgr = Gio.DBusObjectManagerClient.new_finish(res); //might throw

        const objPaths = objMgr.get_objects().filter(function(o) {
          return o.get_interface("org.freedesktop.UDisks2.Drive") != null
            && o.get_interface("org.freedesktop.UDisks2.Drive.Ata") != null;
        }).map(function(o) { return o.get_object_path(); });

        // now create the proxy objects, log and ignore every failure
        Async.map(objPaths, function(obj, callback) {
          // create the proxies object
          const driveProxy = new UDisksDriveProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, function(res, error) {
            if (error) { //very unlikely - we even checked the interfaces before!
              Logger.error('Could not create proxy on ' + obj + ':' + error);
              callback(null);
              return;
            }
            const ataProxy = new UDisksDriveAtaProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, function(res, error) {
              if (error) {
                Logger.error('Could not create proxy on ' + obj + ':' + error);
                callback(null);
                return;
              }

              callback({ drive: driveProxy, ata: ataProxy });
            });
          });
        }, function(proxies) {
          // filter out failed attempts == null values
          callback(proxies.filter(function(a) { return a != null; }));
        });
      } catch (e) {
        Logger.error('Could not find UDisks objects: ' + e);
      }
    });
  }
};
