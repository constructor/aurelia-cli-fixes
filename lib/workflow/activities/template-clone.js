'use strict';
const exec = require('child_process').exec;
const process = require('process');

const NPM = require('../../package-managers/npm').NPM;
const Yarn = require('../../package-managers/yarn').Yarn;

const os = require('os');
const UI = require('../../ui').UI;
const transform = require('../../colors/transform');
const createLines = require('../../string').createLines;
const CLIOptions = require('../../cli-options').CLIOptions;

const del = require('del');
const which = require('which');

module.exports = class {
  static inject() { return [UI, CLIOptions]; }

  constructor(ui, options) {
    this.ui = ui;
    this.options = options;
  }

  async execute(context) {
    let template = context.state.template;

    await this.generateTemplate(context).catch((error) => {
      return this.ui.log('There was an error generating the template.')
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

  async generateTemplate(context) {
    let template = context.state.template;
    this.ui.log(os.EOL + "Generating project from template: " + template.name + os.EOL);

    let name, output;

    if (context.state.output != null)
      output = context.state.output;

    return new Promise((resolve, reject) => {
      try {
        if (this.hasGit()) {
          this.ui.log('Cloning template...' + os.EOL);

          var path = this.gitPath();
          var cmd = 'clone';
          var url = template.id;
          var folder = output ? output : 'Project';
          var remove = `${folder}/.git`;

          var cmd = `"${path}" ${cmd} ${url} ${folder}`;
          cmd = cmd.trim();

          this.ui.log(cmd);

          exec(cmd, (error, stdout, stderr) => {
            if (error)
              throw error;

            this.ui.log(stdout);

            del([remove]).then(paths => {
              this.ui.log('Preparing files...');
              resolve(true);
            });
          });
        }
        else
          this.ui.log('Could not clone template as git not found...' + os.EOL);

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

  hasGit() {
    let gitPath;
    try {
      gitPath = which.sync('git');
      if (gitPath.toUpperCase().indexOf('GIT.EXE') > -1)
        return true;
    } catch (e) {
      return false;
    }
  }

  gitPath() {
    let gitPath;
    try {
      gitPath = which.sync('git');
      if (gitPath.toUpperCase().indexOf('GIT.EXE') > -1)
        return gitPath;
    } catch (e) {
      this.ui.log(os.EOL + os.EOL + e);
      return null;
    }
  }

};
