'use strict';
var AnsiEscapes = require('ansi-escapes');
var AnsiStyles = require('ansi-styles');
var webpack = require('webpack');

require('object.assign').shim();

var cursorUp = AnsiEscapes.cursorUp;
var cursorDown = AnsiEscapes.cursorDown;
var eraseEndLine = AnsiEscapes.eraseEndLine;
var cursorSavePosition = AnsiEscapes.cursorSavePosition;
var cursorRestorePosition = AnsiEscapes.cursorRestorePosition;

var stdoutLineCount = 0;

function onProgress(progress, messages, step, isInProgress, options) {
  if (isInProgress) {
    if (options.restoreCursorPosition) {
      options.logger(cursorSavePosition + cursorUp(1));
    }
    options.logger(cursorUp(stdoutLineCount + 2));
  } else {
    options.logger('');
  }

  options.logger(options.getProgressMessage(progress, messages, AnsiStyles) +
    eraseEndLine + (!isInProgress ? cursorDown(1) : '')
  );
  if (isInProgress) {
    if (options.restoreCursorPosition) {
      options.logger(cursorRestorePosition + cursorUp(1));
    } else if (stdoutLineCount > 0) {
      options.logger(cursorDown(stdoutLineCount - 1));
    }
  }
}

module.exports = function NyanProgressPlugin(options) {
  var timer = 0;
  var shift = 0;
  var originalStdoutWrite;
  var isPrintingProgress = false;
  var isStarted = false;
  var startTime = 0;

  options = Object.assign({
    debounceInterval: 180,
    logger: console.log.bind(console), // eslint-disable-line no-console
    hookStdout: true,
    getProgressMessage: function(percentage, messages, styles) {
      return styles.cyan.open + messages[0] + styles.cyan.close +
        (messages[1] ?
          ' ' + styles.green.open + '(' + messages[1] + ')' + styles.green.close :
          ''
        );
    },
    nyanCatSays: function (progress) { return progress === 1 && 'Nyan!'; }
  }, options);

  if (options.hookStdout) {
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = function(msg) {
      originalStdoutWrite.apply(process.stdout, arguments);
      if (isStarted && !isPrintingProgress) {
        stdoutLineCount += msg.split('\n').length - 1;
      }
    }
  }

  return new webpack.ProgressPlugin(function(progress, message) {
    var now = new Date().getTime();
    if (!isStarted) {
      onProgress(progress, [message], shift++, false, options);
      startTime = now;
      isStarted = true;
    } else if (progress === 1) {
      isPrintingProgress = true;
      var endTimeMessage = 'build time: ' + (now - startTime) / 1000 + 's';
      onProgress(progress, [message, endTimeMessage], shift++, true, options);
      isPrintingProgress = false;

      if (originalStdoutWrite) {
        process.stdout.write = originalStdoutWrite;
      }
      stdoutLineCount = 0;
      isStarted = false;
    } else if (now - timer > options.debounceInterval) {
      timer = now;
      isPrintingProgress = true;
      onProgress(progress, [message], shift++, true, options);
      isPrintingProgress = false;
    }
  });
};
