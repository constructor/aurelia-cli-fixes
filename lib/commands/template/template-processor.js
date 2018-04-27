const fs = require('fs');
const path = require('path');
const os = require('os');

class TemplateProcessor {
  constructor(state) {
    this.state = state;
    this.folderName = null;
  }

  async process(ui) {
    this.ui = ui;

    let tp = this;
    let results = [];

    return new Promise((resolve, reject) => {
      try {
        this.processArgs();

        if (!this.requiresProcessing(this.folderName)) {
          tp.ui.log(`${os.EOL}No aurelia.template file found. No processing attempted.${os.EOL}`);
          return;
        }

        tp.ui.log(`${os.EOL}Processing template folder: ${this.folderName}${os.EOL}`);

        this.readTemplateData(this.folderName, (data) => { this.templateData = data });
        this.getFiles(this.folderName, results);
        this.processFiles(results);

        resolve(true);
      }
      catch (error)
      {
        reject(error);
      }
    });
  }

  processArgs() {
    this.folderName = this.state.output ? this.state.output : '';
    this.projectName = this.state.projectName ? this.state.projectName : '';
    this.namespace = this.state.namespace ? this.state.namespace : '';
  }

  readTemplateData(folderName) {
    var p = path.join(process.cwd(), folderName, 'aurelia.template');
    var data = fs.readFileSync(p, 'utf8');
    this.templateData = JSON.parse(data);
  }

  getFiles(dir, results) {
    let tp = this;
    var list = fs.readdirSync(dir);

    list.forEach((item) => {
      var fullPath = path.resolve(dir, item);
      var stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) { // Directory so recursive call
        //Add directory?
        //results.push(fullPath);

        results.concat(this.getFiles(fullPath, results));
      } else 
        results.push(fullPath);
    });
  }

  processFiles(files) {
    if (!this.requiresProcessing(this.folderName))
      reject("Could not find aurelia.template file.")

    //processing and renaming together can cause file lock issues.
    //file content pass
    for (var i = 0; i < files.length; i++) {
      var filePath = files[i];
      if (filePath.indexOf('aurelia.template') < 0)
        this.processFile(filePath, this.templateData);
    }

    //file renaming pass
    for (var i = 0; i < files.length; i++) {
      var filePath = files[i];
      if (filePath.indexOf('aurelia.template') < 0)
        this.renameFile(filePath, this.templateData);
    }
  }

  requiresProcessing(folderName) {
    var p = path.join(process.cwd(), folderName, 'aurelia.template');
    return fs.existsSync(p);
  }

  processFile(filePath, templateData) {
    this.ui.log(`Processing file ${filePath}`);
    var pageData = fs.readFileSync(filePath, 'utf8');
    var result = this.replaceData(pageData, templateData);
    fs.writeFileSync(filePath, result);
  }

  renameFile(filePath, templateData) {
    for (var prop in templateData) {
      var filename = path.basename(filePath);
      var extname = path.extname(filename);

      if (prop == filename) {
        var propVal = templateData[prop] ? templateData[prop] : '';
        var isPropArg = false;
        var newFile;

        if (propVal.indexOf('{') > -1 && propVal.indexOf('}') > -1) {
          isPropArg = true;
          propVal = propVal.replace('{', '');
          propVal = propVal.replace('}', '');
          newFile = (this.state[propVal] ? this.state[propVal] : '');
        }
        else
          newFile = propVal;

        if (newFile && typeof (newFile) == 'string' & newFile != '') {
          newFile = newFile + extname;
          var fileDir = path.dirname(filePath);
          var newPath = path.join(fileDir, newFile);

          this.ui.log(`Renaming '${filePath}' to '${newPath}'`);

          fs.renameSync(filePath, newPath);
        } else {
          this.ui.log(`${filename} unchanged. 'newFile' value was: ${newFile}`);
        }
      }
    }
  }

  replaceData(pageData, templateData) {
    for (var prop in templateData) {
      //var key = '{{au-' + prop + '}}';
      var isPropArg = false;
      var rex = new RegExp(prop, 'gm');
      var propVal = templateData[prop];
      var val;

      if (propVal.indexOf('{') > -1 && propVal.indexOf('}') > -1) {
        isPropArg = true;
        propVal = propVal.replace('{', '');
        propVal = propVal.replace('}', '');
        val = (this.state[propVal] ? this.state[propVal] : '');
      }

      //this.ui.log(`key:${key} - val:${val}`);
      if (val && typeof (val) == 'string' && val != '')
        pageData = pageData.replace(rex, val);
    }
    return pageData;
  }

}

module.exports = (state) => { return new TemplateProcessor(state) }
