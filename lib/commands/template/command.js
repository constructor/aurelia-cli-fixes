'use strict';
const exec = require('child_process').exec;
const WorkflowEngine = require('../../workflow/workflow-engine').WorkflowEngine;
const UI = require('../../ui').UI;
const Container = require('aurelia-dependency-injection').Container;
const CLIOptions = require('../../cli-options').CLIOptions;

const which = require('which');

//key is the canonical name to which all alias values are set.
//args passed that are not recognised below will be parsed directly.
const commandParams = [
  { key: 'output', aliases: ['o', 'op'] },
  { key: 'projectName', aliases: ['n', 'name'] },
  { key: 'namespace', aliases: ['ns'] }
];

//au template --name "Site" --output "/NewFolder/Name" --custom 123
module.exports = class {
  static inject() { return [Container, UI, CLIOptions]; }

  constructor(container, ui, options) {
    this.container = container;
    this.ui = ui;
    this.options = options;
  }

  execute(args) {
    let definition = require('./new-template.json');
    let engine = new WorkflowEngine(
      definition,
      this.container
    );

    console.log("Hello World!");

    let state = {};

    if (this.options.hasFlag('here')) {
      state.name = this.options.originalBaseDir;
      state.defaultOrCustomOverride = 'custom';

      if (state.name.indexOf('/') !== -1) {
        let parts = state.name.split('/');
        state.name = parts[parts.length - 1];
      } else if (state.name.indexOf('\\') !== -1) {
        let parts = state.name.split('\\');
        state.name = parts[parts.length - 1];
      }

      //TODO: find a better solution
      state.name = state.name.replace(' ', '');

    } else if (args[0] && !args[0].startsWith('--') && !args[0].startsWith('-')) {
      state.name = args[0];
    }

    this.parseArgs(args, state);

    return this.ui.displayLogo()
      .then(() => engine.start(state))
      .catch(error => {
        return this.ui.log('There was an error generating the Aurelia template.')
          .then(() => { throw error; });
      });

  }

  parseArgs(args, state) {
    for (var i = 0; i < commandParams.length; i++) {
      var param = commandParams[i];
      this.parseArg(args, state, param.key, param.aliases);
    }

    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      if (this.isCustomParam(arg))
        this.parseCustomArg(arg, args, state);
    }
  }

  parseCustomArg(arg, args, state) {
    var argName = arg;
    while (argName.charAt(0) === '-')
      argName = argName.substr(1);

    this.parseItem(args, state, argName, argName);
  }

  parseArg(args, state, key, aliases) {
    var foundKey = this.parseItem(args, state, key, key);

    if (foundKey)
      return true;

    for (var i = 0; i < aliases.length; i++) {
      var alias = aliases[i];
      foundKey = this.parseItem(args, state, alias, key);
    }

    return foundKey;
  }

  parseItem(args, state, item, key) {
    var itemIndex = args.indexOf('-' + item) > -1 ? args.indexOf('-' + item) : args.indexOf('--' + item);

    if (itemIndex < 0)
      return false;

    var valueIndex = itemIndex + 1;

    if (args[valueIndex] !== void 0) 
      var val = args[valueIndex];

    var isLastArg = (valueIndex == args.length);
    var beginsWithDash = val ? (val.startsWith('-') || val.startsWith('--')) : false;

    if (isLastArg || beginsWithDash)// this is another key so treat current key as a bool flag
      state[key] = true;
    else
      state[key] = args[valueIndex];

    return true;
  }

  isCustomParam(name) {
    while (name.charAt(0) === '-')
      name = name.substr(1);

    var result = commandParams.filter((i) => { return name == i.key || i.aliases.indexOf(name) > -1 });
    return result.length < 1;
  }

};
