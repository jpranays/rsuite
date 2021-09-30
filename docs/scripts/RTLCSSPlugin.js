/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const rtlcss = require('rtlcss');
const postcss = require('postcss');

const { NODE_ENV, STYLE_DEBUG } = process.env;

class RTLCSSPlugin {
  constructor(options) {
    this.options = options || {};
  }

  apply(compiler) {
    const taskQueue = [];
    compiler.hooks.emit.tapAsync('RTLCSSPlugin', (compilation, callback) => {
      const postCssProcess = (content, assetName) =>
        postcss(
          STYLE_DEBUG === 'STYLE' || NODE_ENV === 'production'
            ? [
                require('autoprefixer'),
                require('cssnano')({
                  preset: [
                    'default',
                    {
                      discardComnments: {
                        removeAll: false
                      }
                    }
                  ]
                })
              ]
            : []
        )
          .process(content)
          .then(result => {
            compilation.assets[assetName] = {
              source: function () {
                return result.css;
              },
              size: function () {
                return result.css.length;
              }
            };
          })
          .catch(error => Promise.reject(error));

      try {
        // Explore each chunk (build output):
        compilation.chunks.forEach(chunk => {
          // Explore each asset filename generated by the chunk:
          chunk.files.forEach(filename => {
            // Get the asset source for each file generated by the chunk:
            const directory = path.dirname(filename),
              cssPath = this.options.path;
            if ((!cssPath || cssPath === directory) && path.extname(filename) === '.css') {
              const cssContent = compilation.assets[filename].source();
              taskQueue.push(postCssProcess(cssContent, filename));
              taskQueue.push(
                postCssProcess(
                  rtlcss.process(cssContent),
                  `${directory}/${path.basename(filename, '.css')}.rtl.css`
                )
              );
            }
          });
        });
      } catch (e) {
        console.error(e);
      }

      Promise.all(taskQueue)
        .catch(error => {
          console.log(error);
          callback();
        })
        .then(() => callback());
    });
  }
}

module.exports = RTLCSSPlugin;
