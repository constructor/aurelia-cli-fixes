'use strict';
const spawn = require('child_process');
const exec = require('child_process').exec;
const process = require('process');

const NPM = require('../../package-managers/npm').NPM;
const Yarn = require('../../package-managers/yarn').Yarn;

const os = require('os');
const UI = require('../../ui').UI;
const transform = require('../../colors/transform');
const createLines = require('../../string').createLines;
const CLIOptions = require('../../cli-options').CLIOptions;
const logger = require('aurelia-logging').getLogger('TemplateInstall');

module.exports = class {
  static inject() { return [UI, CLIOptions]; }

  constructor(ui, options) {
    this.ui = ui;
    this.options = options;
  }

  async execute(context) {
    let template = context.state.template;

    var checkResult = await this.checkTemplate(template);

    if (!checkResult.exists)
      checkResult.exists = await this.installTemplate(template).catch(error => {
        return this.ui.log('There was an error installing the template.')
          .then(() => { throw error; });
      });

    if (checkResult.exists)
      await this.generateTemplate(context).catch(error => {
        return this.ui.log('There was an error generating the project.')
          .then(() => { throw error; });
      });

    return this.ui.question('Would you like to install the project dependencies?', [
      {
        displayName: 'Yes',
        description: 'Installs all server, client and tooling dependencies needed to build the project.',
        value: 'yes'
      },
      {
        displayName: 'No',
        description: 'Completes the new project wizard without installing dependencies.',
        value: 'no'
      }
    ]).then(answer => {
      if (answer.value === 'yes') {
        return this.ui.log(os.EOL + 'Installing project dependencies.')
          .then(() => this.installDependencies(this.ui, context.state))
          .then(() => this.displayCompletionMessage(context.state))
          .then(() => context.next(this.nextActivity));
      }

      return this.ui.log(os.EOL + 'Dependencies not installed.')
        .then(() => context.next());
    });
  }

  async checkTemplate(template) {
    this.ui.log(os.EOL + "Checking for template: " + template.id);
    return new Promise((resolve, reject) => {
      var cmd_chk = 'dotnet new ' + template.cmd + ' -l';
      exec(cmd_chk, (error, stdout, stderr) => {
        if (error)
          reject(error);

        var exists = stdout.indexOf(template.cmd) > -1;
        this.ui.log(exists ? "Template: " + template.id + " found. No install required" : "Template: " + template.id + " not found.");
        resolve({ exists: exists, stdout: stdout});
      });
    });
  }

  async installTemplate(template) {
    return new Promise((resolve, reject) => {
      var cmd_install = 'dotnet new -i ' + template.id;
      this.ui.log('Installing template: ' + template.id) + os.EOL;

      exec(cmd_install, (error, stdout, stderr) => {
        var noPackage = stdout.lastIndexOf('No packages exist') > -1;
        if (error || noPackage) {
          this.ui.log(transform('<bgRed><white><bold>Error installing template: ' + template.id + '</bold></white></bgRed>'));

          if (noPackage)
            this.ui.log('Package for template ' + template.id + ' could not be found.' + os.EOL);

          if(error)
            this.ui.log(error);

          reject(error ? error : new Error('Template install failed. noPackage:' + noPackage));
        }

        resolve(true);
      });
    });
  }

  async generateTemplate(context) {
    let template = context.state.template;
    this.ui.log("Generating project from template: " + template.id);

    let name, output;

    if (context.state.name != null)
      name = context.state.name;

    if (context.state.output != null)
      output = context.state.output;

    return new Promise((resolve, reject) => {
      try {
        var cmd_generate = 'dotnet new ' +
          template.cmd +
          ' -ow "Bob" -t "Test Site"' +
          (name ? ' -n ' + name : '') +
          (output ? ' -o ' + output : '');

        exec(cmd_generate, (error, stdout, stderr) => {
          if (error)
            reject(error);

          this.ui.log(stdout + os.EOL);
          this.ui.log("Project generated from " + template.id + os.EOL);
          resolve(true);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  installDependencies(ui, state, dependencies) {
    var workingDirectory = process.cwd() + '\\' + state.name;

    if (state.output != null)
      workingDirectory = process.cwd() + '\\' + state.output;

    let npm = new NPM();
    let npmOptions = {
      loglevel: 'error',
      color: 'always',
      save: true,
      'save-dev': true,
      workingDirectory: workingDirectory
    };

    // try yarn, but if something fails then fall back to NPM
    try {
      let yarn = new Yarn();
      if (yarn.isAvailable(workingDirectory)) {
        return yarn.install([], { cwd: workingDirectory })
          .catch(e => {
            logger.error('Something went wrong while attempting to use Yarn. Falling back to NPM');
            logger.info(e);

            return npm.install([], npmOptions);
          });
      }
    } catch (e) {
      logger.error('Something went wrong while attempting to search for Yarn. Falling back to NPM');
      logger.info(e);
    }

    return npm.install([], npmOptions);
  }

  displayCompletionMessage(state) {
    let message = '<bgGreen><white><bold>Getting started</bold></white></bgGreen> ' + os.EOL + os.EOL;
    message += 'Template installed. Now it\'s time for you to get started. It\'s easy.';

    let runCommand = 'au run';

    //TODO: pass through or link to template specific instructions?

    //if (project.model.bundler.id === 'webpack' && project.model.platform.id === 'aspnetcore') {
    //  runCommand = 'dotnet run';
    //}

    //if (this.options.hasFlag('here')) {
    //  message += ` Simply run your new app with <magenta><bold>${runCommand}</bold></magenta>.`;
    //} else {
    //  message += ` First, change directory into your new project's folder. You can use <magenta><bold>cd ${state.name}</bold></magenta> to get there. Once in your project folder, simply run your new app with <magenta><bold>${runCommand}</bold></magenta>.`;
    //}

    //if (project.model.bundler.id === 'cli' || project.model.platform.id === 'web') {
    //  message += ' Your app will run fully bundled. If you would like to have it auto-refresh whenever you make changes to your HTML, JavaScript or CSS, simply use the <yellow>--watch</yellow> flag';
    //}

    message += ' If you want to build your app for production, run <magenta><bold>au build --env prod</bold></magenta>. That\'s just about all there is to it. If you need help, simply run <magenta><bold>au help</bold></magenta>.';

    return this.ui.clearScreen()
      .then(() => this.ui.log(transform('<bgGreen><white><bold>Congratulations</bold></white></bgGreen>') + os.EOL + os.EOL))
      .then(() => this.ui.log(`Congratulations! Your project "${state.name}" has been generated from the template: ${state.template.id}` + os.EOL + os.EOL))
      .then(() => this.ui.log(createLines(transform(message), '', this.ui.getWidth())))
      .then(() => this.ui.log(os.EOL + os.EOL + 'Happy Coding!' + os.EOL + os.EOL));
  }

};
