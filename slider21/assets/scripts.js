// A cross-browser javascript shim for html5 audio
(function(audiojs, audiojsInstance, container) {
  // Use the path to the audio.js file to create relative paths to the swf and player graphics
  // Remember that some systems (e.g. ruby on rails) append strings like '?1301478336' to asset paths
  var path = (function() {
    var re = new RegExp('audio(\.min)?\.js.*'),
        scripts = document.getElementsByTagName('script');
    for (var i = 0, ii = scripts.length; i < ii; i++) {
      var path = scripts[i].getAttribute('src');
      if(re.test(path)) return path.replace(re, '');
    }
  })();

  // ##The audiojs interface
  // This is the global object which provides an interface for creating new `audiojs` instances.
  // It also stores all of the construction helper methods and variables.
  container[audiojs] = {
    instanceCount: 0,
    instances: {},
    // The markup for the swf. It is injected into the page if there is not support for the `<audio>` element. The `$n`s are placeholders.
    // `$1` The name of the flash movie
    // `$2` The path to the swf
    // `$3` Cache invalidation
    flashSource: '\
      <object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" id="$1" width="1" height="1" name="$1" style="position: absolute; left: -1px;"> \
        <param name="movie" value="$2?playerInstance='+audiojs+'.instances[\'$1\']&datetime=$3"> \
        <param name="allowscriptaccess" value="always"> \
        <embed name="$1" src="$2?playerInstance='+audiojs+'.instances[\'$1\']&datetime=$3" width="1" height="1" allowscriptaccess="always"> \
      </object>',

    // ### The main settings object
    // Where all the default settings are stored. Each of these variables and methods can be overwritten by the user-provided `options` object.
    settings: {
      autoplay: false,
      loop: false,
      preload: true,
      imageLocation: path + 'player-graphics.gif',
      swfLocation: path + 'audiojs.swf',
      useFlash: (function() {
        var a = document.createElement('audio');
        return !(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
      })(),
      hasFlash: (function() {
        if (navigator.plugins && navigator.plugins.length && navigator.plugins['Shockwave Flash']) {
          return true;
        } else if (navigator.mimeTypes && navigator.mimeTypes.length) {
          var mimeType = navigator.mimeTypes['application/x-shockwave-flash'];
          return mimeType && mimeType.enabledPlugin;
        } else {
          try {
            var ax = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
            return true;
          } catch (e) {}
        }
        return false;
      })(),
      // The default markup and classes for creating the player:
      createPlayer: {
        markup: '\
          <div class="play-pause"> \
            <p class="play"></p> \
            <p class="pause"></p> \
            <p class="loading"></p> \
            <p class="error"></p> \
          </div> \
          <div class="scrubber-container"> \
            <div class="scrubber"> \
              <div class="progress"></div> \
              <div class="loaded"></div> \
            </div> \
          </div> \
          <div class="time"> \
            <em class="played">00:00</em>/<strong class="duration">00:00</strong> \
          </div> \
          <div class="error-message"></div>',
        playPauseClass: 'play-pause',
        scrubberClass: 'scrubber',
        progressClass: 'progress',
        loaderClass: 'loaded',
        timeClass: 'time',
        durationClass: 'duration',
        playedClass: 'played',
        errorMessageClass: 'error-message',
        playingClass: 'playing',
        loadingClass: 'loading',
        errorClass: 'error'
      },
      // The css used by the default player. This is is dynamically injected into a `<style>` tag in the top of the head.
      css: '\
        .audiojs audio { position: absolute; left: -1px; } \
        .audiojs { width: 460px; height: 36px; background: #404040; overflow: hidden; font-family: monospace; font-size: 12px; \
          background-image: -webkit-gradient(linear, left top, left bottom, color-stop(0, #444), color-stop(0.5, #555), color-stop(0.51, #444), color-stop(1, #444)); \
          background-image: -moz-linear-gradient(center top, #444 0%, #555 50%, #444 51%, #444 100%); \
          -webkit-box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.3); -moz-box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.3); \
          -o-box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.3); box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.3); } \
        .audiojs .play-pause { width: 25px; height: 40px; padding: 4px 6px; margin: 0px; float: left; overflow: hidden; border-right: 1px solid #000; } \
        .audiojs p { display: none; width: 25px; height: 40px; margin: 0px; cursor: pointer; } \
        .audiojs .play { display: block; } \
        .audiojs .scrubber { position: relative; float: left; width: 280px; background: #5a5a5a; height: 14px; margin: 10px; border-top: 1px solid #3f3f3f; border-left: 0px; border-bottom: 0px; overflow: hidden; } \
        .audiojs .progress { position: absolute; top: 0px; left: 0px; height: 14px; width: 0px; background: #ccc; z-index: 1; \
          background-image: -webkit-gradient(linear, left top, left bottom, color-stop(0, #ccc), color-stop(0.5, #ddd), color-stop(0.51, #ccc), color-stop(1, #ccc)); \
          background-image: -moz-linear-gradient(center top, #ccc 0%, #ddd 50%, #ccc 51%, #ccc 100%); } \
        .audiojs .loaded { position: absolute; top: 0px; left: 0px; height: 14px; width: 0px; background: #000; \
          background-image: -webkit-gradient(linear, left top, left bottom, color-stop(0, #222), color-stop(0.5, #333), color-stop(0.51, #222), color-stop(1, #222)); \
          background-image: -moz-linear-gradient(center top, #222 0%, #333 50%, #222 51%, #222 100%); } \
        .audiojs .time { float: left; height: 36px; line-height: 36px; margin: 0px 0px 0px 6px; padding: 0px 6px 0px 12px; border-left: 1px solid #000; color: #ddd; text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5); } \
        .audiojs .time em { padding: 0px 2px 0px 0px; color: #f9f9f9; font-style: normal; } \
        .audiojs .time strong { padding: 0px 0px 0px 2px; font-weight: normal; } \
        .audiojs .error-message { float: left; display: none; margin: 0px 10px; height: 36px; width: 400px; overflow: hidden; line-height: 36px; white-space: nowrap; color: #fff; \
          text-overflow: ellipsis; -o-text-overflow: ellipsis; -icab-text-overflow: ellipsis; -khtml-text-overflow: ellipsis; -moz-text-overflow: ellipsis; -webkit-text-overflow: ellipsis; } \
        .audiojs .error-message a { color: #eee; text-decoration: none; padding-bottom: 1px; border-bottom: 1px solid #999; white-space: wrap; } \
        \
        .audiojs .play { background: url("$1") -2px -1px no-repeat; } \
        .audiojs .loading { background: url("$1") -2px -31px no-repeat; } \
        .audiojs .error { background: url("$1") -2px -61px no-repeat; } \
        .audiojs .pause { background: url("$1") -2px -91px no-repeat; } \
        \
        .playing .play, .playing .loading, .playing .error { display: none; } \
        .playing .pause { display: block; } \
        \
        .loading .play, .loading .pause, .loading .error { display: none; } \
        .loading .loading { display: block; } \
        \
        .error .time, .error .play, .error .pause, .error .scrubber, .error .loading { display: none; } \
        .error .error { display: block; } \
        .error .play-pause p { cursor: auto; } \
        .error .error-message { display: block; }',
      // The default event callbacks:
      trackEnded: function(e) {},
      flashError: function() {
        var player = this.settings.createPlayer,
            errorMessage = getByClass(player.errorMessageClass, this.wrapper),
            html = 'Missing <a href="http://get.adobe.com/flashplayer/">flash player</a> plugin.';
        if (this.mp3) html += ' <a href="'+this.mp3+'">Download audio file</a>.';
        container[audiojs].helpers.removeClass(this.wrapper, player.loadingClass);
        container[audiojs].helpers.addClass(this.wrapper, player.errorClass);
        errorMessage.innerHTML = html;
      },
      loadError: function(e) {
        var player = this.settings.createPlayer,
            errorMessage = getByClass(player.errorMessageClass, this.wrapper);
        container[audiojs].helpers.removeClass(this.wrapper, player.loadingClass);
        container[audiojs].helpers.addClass(this.wrapper, player.errorClass);
        errorMessage.innerHTML = 'Error loading: "'+this.mp3+'"';
      },
      init: function() {
        var player = this.settings.createPlayer;
        container[audiojs].helpers.addClass(this.wrapper, player.loadingClass);
      },
      loadStarted: function() {
        var player = this.settings.createPlayer,
            duration = getByClass(player.durationClass, this.wrapper),
            m = Math.floor(this.duration / 60),
            s = Math.floor(this.duration % 60);
        container[audiojs].helpers.removeClass(this.wrapper, player.loadingClass);
        duration.innerHTML = ((m<10?'0':'')+m+':'+(s<10?'0':'')+s);
      },
      loadProgress: function(percent) {
        var player = this.settings.createPlayer,
            loaded = getByClass(player.loaderClass, this.wrapper);
        loaded.style.width = (100 * percent) + '%';
      },
      playPause: function() {
        if (this.playing) this.settings.play();
        else this.settings.pause();
      },
      play: function() {
        var player = this.settings.createPlayer;
        container[audiojs].helpers.addClass(this.wrapper, player.playingClass);
      },
      pause: function() {
        var player = this.settings.createPlayer;
        container[audiojs].helpers.removeClass(this.wrapper, player.playingClass);
      },
      updatePlayhead: function(percent) {
        var player = this.settings.createPlayer,
            progress = getByClass(player.progressClass, this.wrapper);
        progress.style.width = (100 * percent) + '%';

        var played = getByClass(player.playedClass, this.wrapper),
            p = this.duration * percent,
            m = Math.floor(p / 60),
            s = Math.floor(p % 60);
        played.innerHTML = ((m<10?'0':'')+m+':'+(s<10?'0':'')+s);
      }
    },

    // ### Contructor functions

    // `create()`
    // Used to create a single `audiojs` instance.
    // If an array is passed then it calls back to `createAll()`.
    // Otherwise, it creates a single instance and returns it.
    create: function(element, options) {
      var options = options || {}
      if (element.length) {
        return this.createAll(options, element);
      } else {
        return this.newInstance(element, options);
      }
    },

    // `createAll()`
    // Creates multiple `audiojs` instances.
    // If `elements` is `null`, then automatically find any `<audio>` tags on the page and create `audiojs` instances for them.
    createAll: function(options, elements) {
      var audioElements = elements || document.getElementsByTagName('audio'),
          instances = []
          options = options || {};
      for (var i = 0, ii = audioElements.length; i < ii; i++) {
        instances.push(this.newInstance(audioElements[i], options));
      }
      return instances;
    },

    // ### Creating and returning a new instance
    // This goes through all the steps required to build out a usable `audiojs` instance.
    newInstance: function(element, options) {
      var element = element,
          s = this.helpers.clone(this.settings),
          id = 'audiojs'+this.instanceCount,
          wrapperId = 'audiojs_wrapper'+this.instanceCount,
          instanceCount = this.instanceCount++;

      // Check for `autoplay`, `loop` and `preload` attributes and write them into the settings.
      if (element.getAttribute('autoplay') != null) s.autoplay = true;
      if (element.getAttribute('loop') != null) s.loop = true;
      if (element.getAttribute('preload') == 'none') s.preload = false;
      // Merge the default settings with the user-defined `options`.
      if (options) this.helpers.merge(s, options);

      // Inject the player html if required.
      if (s.createPlayer.markup) element = this.createPlayer(element, s.createPlayer, wrapperId);
      else element.parentNode.setAttribute('id', wrapperId);

      // Return a new `audiojs` instance.
      var audio = new container[audiojsInstance](element, s);

      // If css has been passed in, dynamically inject it into the `<head>`.
      if (s.css) this.helpers.injectCss(audio, s.css);

      // If `<audio>` or mp3 playback isn't supported, insert the swf & attach the required events for it.
      if (s.useFlash && s.hasFlash) {
        this.injectFlash(audio, id);
        this.attachFlashEvents(audio.wrapper, audio);
      } else if (s.useFlash && !s.hasFlash) {
        this.settings.flashError.apply(audio);
      }

      // Attach event callbacks to the new audiojs instance.
      if (!s.useFlash || (s.useFlash && s.hasFlash)) this.attachEvents(audio.wrapper, audio);

      // Store the newly-created `audiojs` instance.
      this.instances[id] = audio;
      return audio;
    },

    // ### Helper methods for constructing a working player
    // Inject a wrapping div and the markup for the html player.
    createPlayer: function(element, player, id) {
      var wrapper = document.createElement('div'),
          newElement = element.cloneNode(true);
      wrapper.setAttribute('class', 'audiojs');
      wrapper.setAttribute('className', 'audiojs');
      wrapper.setAttribute('id', id);

      // Fix IE's broken implementation of `innerHTML` & `cloneNode` for HTML5 elements.
      if (newElement.outerHTML && !document.createElement('audio').canPlayType) {
        newElement = this.helpers.cloneHtml5Node(element);
        wrapper.innerHTML = player.markup;
        wrapper.appendChild(newElement);
        element.outerHTML = wrapper.outerHTML;
        wrapper = document.getElementById(id);
      } else {
        wrapper.appendChild(newElement);
        wrapper.innerHTML = wrapper.innerHTML + player.markup;
        element.parentNode.replaceChild(wrapper, element);
      }
      return wrapper.getElementsByTagName('audio')[0];
    },

    // Attaches useful event callbacks to an `audiojs` instance.
    attachEvents: function(wrapper, audio) {
      if (!audio.settings.createPlayer) return;
      var player = audio.settings.createPlayer,
          playPause = getByClass(player.playPauseClass, wrapper),
          scrubber = getByClass(player.scrubberClass, wrapper),
          leftPos = function(elem) {
            var curleft = 0;
            if (elem.offsetParent) {
              do { curleft += elem.offsetLeft; } while (elem = elem.offsetParent);
            }
            return curleft;
          };

      container[audiojs].events.addListener(playPause, 'click', function(e) {
        audio.playPause.apply(audio);
      });

      container[audiojs].events.addListener(scrubber, 'click', function(e) {
        var relativeLeft = e.clientX - leftPos(this);
        audio.skipTo(relativeLeft / scrubber.offsetWidth);
      });

      // _If flash is being used, then the following handlers don't need to be registered._
      if (audio.settings.useFlash) return;

      // Start tracking the load progress of the track.
      container[audiojs].events.trackLoadProgress(audio);

      container[audiojs].events.addListener(audio.element, 'timeupdate', function(e) {
        audio.updatePlayhead.apply(audio);
      });

      container[audiojs].events.addListener(audio.element, 'ended', function(e) {
        audio.trackEnded.apply(audio);
      });

      container[audiojs].events.addListener(audio.source, 'error', function(e) {
        // on error, cancel any load timers that are running.
        clearInterval(audio.readyTimer);
        clearInterval(audio.loadTimer);
        audio.settings.loadError.apply(audio);
      });

    },

    // Flash requires a slightly different API to the `<audio>` element, so this method is used to overwrite the standard event handlers.
    attachFlashEvents: function(element, audio) {
      audio['swfReady'] = false;
      audio['load'] = function(mp3) {
        // If the swf isn't ready yet then just set `audio.mp3`. `init()` will load it in once the swf is ready.
        audio.mp3 = mp3;
        if (audio.swfReady) audio.element.load(mp3);
      }
      audio['loadProgress'] = function(percent, duration) {
        audio.loadedPercent = percent;
        audio.duration = duration;
        audio.settings.loadStarted.apply(audio);
        audio.settings.loadProgress.apply(audio, [percent]);
      }
      audio['skipTo'] = function(percent) {
        if (percent > audio.loadedPercent) return;
        audio.updatePlayhead.call(audio, [percent])
        audio.element.skipTo(percent);
      }
      audio['updatePlayhead'] = function(percent) {
        audio.settings.updatePlayhead.apply(audio, [percent]);
      }
      audio['play'] = function() {
        // If the audio hasn't started preloading, then start it now.
        // Then set `preload` to `true`, so that any tracks loaded in subsequently are loaded straight away.
        if (!audio.settings.preload) {
          audio.settings.preload = true;
          audio.element.init(audio.mp3);
        }
        audio.playing = true;
        // IE doesn't allow a method named `play()` to be exposed through `ExternalInterface`, so lets go with `pplay()`.
        // <http://dev.nuclearrooster.com/2008/07/27/externalinterfaceaddcallback-can-cause-ie-js-errors-with-certain-keyworkds/>
        audio.element.pplay();
        audio.settings.play.apply(audio);
      }
      audio['pause'] = function() {
        audio.playing = false;
        // Use `ppause()` for consistency with `pplay()`, even though it isn't really required.
        audio.element.ppause();
        audio.settings.pause.apply(audio);
      }
      audio['setVolume'] = function(v) {
        audio.element.setVolume(v);
      }
      audio['loadStarted'] = function() {
        // Load the mp3 specified by the audio element into the swf.
        audio.swfReady = true;
        if (audio.settings.preload) audio.element.init(audio.mp3);
        if (audio.settings.autoplay) audio.play.apply(audio);
      }
    },

    // ### Injecting an swf from a string
    // Build up the swf source by replacing the `$keys` and then inject the markup into the page.
    injectFlash: function(audio, id) {
      var flashSource = this.flashSource.replace(/\$1/g, id);
      flashSource = flashSource.replace(/\$2/g, audio.settings.swfLocation);
      // `(+new Date)` ensures the swf is not pulled out of cache. The fixes an issue with Firefox running multiple players on the same page.
      flashSource = flashSource.replace(/\$3/g, (+new Date + Math.random()));
      // Inject the player markup using a more verbose `innerHTML` insertion technique that works with IE.
      var html = audio.wrapper.innerHTML,
          div = document.createElement('div');
      div.innerHTML = flashSource + html;
      audio.wrapper.innerHTML = div.innerHTML;
      audio.element = this.helpers.getSwf(id);
    },

    // ## Helper functions
    helpers: {
      // **Merge two objects, with `obj2` overwriting `obj1`**
      // The merge is shallow, but that's all that is required for our purposes.
      merge: function(obj1, obj2) {
        for (attr in obj2) {
          if (obj1.hasOwnProperty(attr) || obj2.hasOwnProperty(attr)) {
            obj1[attr] = obj2[attr];
          }
        }
      },
      // **Clone a javascript object (recursively)**
      clone: function(obj){
        if (obj == null || typeof(obj) !== 'object') return obj;
        var temp = new obj.constructor();
        for (var key in obj) temp[key] = arguments.callee(obj[key]);
        return temp;
      },
      // **Adding/removing classnames from elements**
      addClass: function(element, className) {
        var re = new RegExp('(\\s|^)'+className+'(\\s|$)');
        if (re.test(element.className)) return;
        element.className += ' ' + className;
      },
      removeClass: function(element, className) {
        var re = new RegExp('(\\s|^)'+className+'(\\s|$)');
        element.className = element.className.replace(re,' ');
      },
      // **Dynamic CSS injection**
      // Takes a string of css, inserts it into a `<style>`, then injects it in at the very top of the `<head>`. This ensures any user-defined styles will take precedence.
      injectCss: function(audio, string) {

        // If an `audiojs` `<style>` tag already exists, then append to it rather than creating a whole new `<style>`.
        var prepend = '',
            styles = document.getElementsByTagName('style'),
            css = string.replace(/\$1/g, audio.settings.imageLocation);

        for (var i = 0, ii = styles.length; i < ii; i++) {
          var title = styles[i].getAttribute('title');
          if (title && ~title.indexOf('audiojs')) {
            style = styles[i];
            if (style.innerHTML === css) return;
            prepend = style.innerHTML;
            break;
          }
        };

        var head = document.getElementsByTagName('head')[0],
            firstchild = head.firstChild,
            style = document.createElement('style');

        if (!head) return;

        style.setAttribute('type', 'text/css');
        style.setAttribute('title', 'audiojs');

        if (style.styleSheet) style.styleSheet.cssText = prepend + css;
        else style.appendChild(document.createTextNode(prepend + css));

        if (firstchild) head.insertBefore(style, firstchild);
        else head.appendChild(styleElement);
      },
      // **Handle all the IE6+7 requirements for cloning `<audio>` nodes**
      // Create a html5-safe document fragment by injecting an `<audio>` element into the document fragment.
      cloneHtml5Node: function(audioTag) {
        var fragment = document.createDocumentFragment(),
            doc = fragment.createElement ? fragment : document;
        doc.createElement('audio');
        var div = doc.createElement('div');
        fragment.appendChild(div);
        div.innerHTML = audioTag.outerHTML;
        return div.firstChild;
      },
      // **Cross-browser `<object>` / `<embed>` element selection**
      getSwf: function(name) {
        var swf = document[name] || window[name];
        return swf.length > 1 ? swf[swf.length - 1] : swf;
      }
    },
    // ## Event-handling
    events: {
      memoryLeaking: false,
      listeners: [],
      // **A simple cross-browser event handler abstraction**
      addListener: function(element, eventName, func) {
        // For modern browsers use the standard DOM-compliant `addEventListener`.
        if (element.addEventListener) {
          element.addEventListener(eventName, func, false);
          // For older versions of Internet Explorer, use `attachEvent`.
          // Also provide a fix for scoping `this` to the calling element and register each listener so the containing elements can be purged on page unload.
        } else if (element.attachEvent) {
          this.listeners.push(element);
          if (!this.memoryLeaking) {
            window.attachEvent('onunload', function() {
              if(this.listeners) {
                for (var i = 0, ii = this.listeners.length; i < ii; i++) {
                  container[audiojs].events.purge(this.listeners[i]);
                }
              }
            });
            this.memoryLeaking = true;
          }
          element.attachEvent('on' + eventName, function() {
            func.call(element, window.event);
          });
        }
      },

      trackLoadProgress: function(audio) {
        // If `preload` has been set to `none`, then we don't want to start loading the track yet.
        if (!audio.settings.preload) return;

        var readyTimer,
            loadTimer,
            audio = audio,
            ios = (/(ipod|iphone|ipad)/i).test(navigator.userAgent);

        // Use timers here rather than the official `progress` event, as Chrome has issues calling `progress` when loading mp3 files from cache.
        readyTimer = setInterval(function() {
          if (audio.element.readyState > -1) {
            // iOS doesn't start preloading the mp3 until the user interacts manually, so this stops the loader being displayed prematurely.
            if (!ios) audio.init.apply(audio);
          }
          if (audio.element.readyState > 1) {
            if (audio.settings.autoplay) audio.play.apply(audio);
            clearInterval(readyTimer);
            // Once we have data, start tracking the load progress.
            loadTimer = setInterval(function() {
              audio.loadProgress.apply(audio);
              if (audio.loadedPercent >= 1) clearInterval(loadTimer);
            }, 200);
          }
        }, 200);
        audio.readyTimer = readyTimer;
        audio.loadTimer = loadTimer;
      },

      // **Douglas Crockford's IE6 memory leak fix**
      // <http://javascript.crockford.com/memory/leak.html>
      // This is used to release the memory leak created by the circular references created when fixing `this` scoping for IE. It is called on page unload.
      purge: function(d) {
        var a = d.attributes, i;
        if (a) {
          for (i = 0; i < a.length; i += 1) {
            if (typeof d[a[i].name] === 'function') d[a[i].name] = null;
          }
        }
        a = d.childNodes;
        if (a) {
          for (i = 0; i < a.length; i += 1) purge(d.childNodes[i]);
        }
      },

      // **DOMready function**
      // As seen here: <https://github.com/dperini/ContentLoaded/>.
      ready: (function() { return function(fn) {
        var win = window, done = false, top = true,
        doc = win.document, root = doc.documentElement,
        add = doc.addEventListener ? 'addEventListener' : 'attachEvent',
        rem = doc.addEventListener ? 'removeEventListener' : 'detachEvent',
        pre = doc.addEventListener ? '' : 'on',
        init = function(e) {
          if (e.type == 'readystatechange' && doc.readyState != 'complete') return;
          (e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
          if (!done && (done = true)) fn.call(win, e.type || e);
        },
        poll = function() {
          try { root.doScroll('left'); } catch(e) { setTimeout(poll, 50); return; }
          init('poll');
        };
        if (doc.readyState == 'complete') fn.call(win, 'lazy');
        else {
          if (doc.createEventObject && root.doScroll) {
            try { top = !win.frameElement; } catch(e) { }
            if (top) poll();
          }
          doc[add](pre + 'DOMContentLoaded', init, false);
          doc[add](pre + 'readystatechange', init, false);
          win[add](pre + 'load', init, false);
        }
      }
      })()

    }
  }

  // ## The audiojs class
  // We create one of these per `<audio>` and then push them into `audiojs['instances']`.
  container[audiojsInstance] = function(element, settings) {
    // Each audio instance returns an object which contains an API back into the `<audio>` element.
    this.element = element;
    this.wrapper = element.parentNode;
    this.source = element.getElementsByTagName('source')[0] || element;
    // First check the `<audio>` element directly for a src and if one is not found, look for a `<source>` element.
    this.mp3 = (function(element) {
      var source = element.getElementsByTagName('source')[0];
      return element.getAttribute('src') || (source ? source.getAttribute('src') : null);
    })(element);
    this.settings = settings;
    this.loadStartedCalled = false;
    this.loadedPercent = 0;
    this.duration = 1;
    this.playing = false;
  }

  container[audiojsInstance].prototype = {
    // API access events:
    // Each of these do what they need do and then call the matching methods defined in the settings object.
    updatePlayhead: function() {
      var percent = this.element.currentTime / this.duration;
      this.settings.updatePlayhead.apply(this, [percent]);
    },
    skipTo: function(percent) {
      if (percent > this.loadedPercent) return;
      this.element.currentTime = this.duration * percent;
      this.updatePlayhead();
    },
    load: function(mp3) {
      this.loadStartedCalled = false;
      this.source.setAttribute('src', mp3);
      // The now outdated `load()` method is required for Safari 4
      this.element.load();
      this.mp3 = mp3;
      container[audiojs].events.trackLoadProgress(this);
    },
    loadError: function() {
      this.settings.loadError.apply(this);
    },
    init: function() {
      this.settings.init.apply(this);
    },
    loadStarted: function() {
      // Wait until `element.duration` exists before setting up the audio player.
      if (!this.element.duration) return false;

      this.duration = this.element.duration;
      this.updatePlayhead();
      this.settings.loadStarted.apply(this);
    },
    loadProgress: function() {
      if (this.element.buffered != null && this.element.buffered.length) {
        // Ensure `loadStarted()` is only called once.
        if (!this.loadStartedCalled) {
          this.loadStartedCalled = this.loadStarted();
        }
        var durationLoaded = this.element.buffered.end(this.element.buffered.length - 1);
        this.loadedPercent = durationLoaded / this.duration;

        this.settings.loadProgress.apply(this, [this.loadedPercent]);
      }
    },
    playPause: function() {
      if (this.playing) this.pause();
      else this.play();
    },
    play: function() {
      var ios = (/(ipod|iphone|ipad)/i).test(navigator.userAgent);
      // On iOS this interaction will trigger loading the mp3, so run `init()`.
      if (ios && this.element.readyState == 0) this.init.apply(this);
      // If the audio hasn't started preloading, then start it now.
      // Then set `preload` to `true`, so that any tracks loaded in subsequently are loaded straight away.
      if (!this.settings.preload) {
        this.settings.preload = true;
        this.element.setAttribute('preload', 'auto');
        container[audiojs].events.trackLoadProgress(this);
      }
      this.playing = true;
      this.element.play();
      this.settings.play.apply(this);
    },
    pause: function() {
      this.playing = false;
      this.element.pause();
      this.settings.pause.apply(this);
    },
    setVolume: function(v) {
      this.element.volume = v;
    },
    trackEnded: function(e) {
      this.skipTo.apply(this, [0]);
      if (!this.settings.loop) this.pause.apply(this);
      this.settings.trackEnded.apply(this);
    }
  }

  // **getElementsByClassName**
  // Having to rely on `getElementsByTagName` is pretty inflexible internally, so a modified version of Dustin Diaz's `getElementsByClassName` has been included.
  // This version cleans things up and prefers the native DOM method if it's available.
  var getByClass = function(searchClass, node) {
    var matches = [];
    node = node || document;

    if (node.getElementsByClassName) {
      matches = node.getElementsByClassName(searchClass);
    } else {
      var i, l,
          els = node.getElementsByTagName("*"),
          pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)");

      for (i = 0, l = els.length; i < l; i++) {
        if (pattern.test(els[i].className)) {
          matches.push(els[i]);
        }
      }
    }
    return matches.length > 1 ? matches : matches[0];
  };
// The global variable names are passed in here and can be changed if they conflict with anything else.
})('audiojs', 'audiojsInstance', this);

$(function() {
  var a = audiojs.createAll({
    trackEnded: function() {
      var next = $('.audio ol li.playing').next();
      if (!next.length) next = $('.audio ol li').first();
      next.addClass('playing').siblings().removeClass('playing');
      audio.load($('a', next).attr('data-src'));
      audio.play();
    }
  });
  var audio = a[0];
  if (audio) {
    first = $('.audio ol a').attr('data-src');
    $('.audio ol li').first().addClass('playing');
    audio.load(first);
    $('.audio ol li').click(function(e) {
      e.preventDefault();
      $(this).addClass('playing').siblings().removeClass('playing');
      audio.load($('a', this).attr('data-src'));
      audio.play();
    });
  }
});

(function($) {
  $( ".backgroundVideo" ).each(function() {
    var fullScreenVideo = fullScreenVideo || {};
    var videoSrc        = $(this).attr('data-src');

    fullScreenVideo = {
        name: 'fullScreenVideo',
        /**
         * CHANGE THESE VARIABLES TO YOUR VIDEOS
         * overlayVideo: The video in the overlay
         * overlayVideoDiv: The jQuery selector of the div containing the overlay video
         * backgroundvideo: The video in the backgorund
         * backgroundideoDiv: The jQuery selector of the div containing the background video
         */
        backgroundvideo: videoSrc,
        backgroundideoDiv: '#wistia_'+videoSrc,

        /**
         * This will call Wistia and embed the two videos
         * @param None
         */
        embedVideo: function()
        {
          var videoOptions = {
            playButton: false,
            autoPlay: true,
            volume: 0,
            videoQuality: "auto",
            endVideoBehavior: "loop",
          };

          // Add the crop fill plugin to the videoOptions
          Wistia.obj.merge(videoOptions, {
            plugin: {
              cropFill: {
                src: "//fast.wistia.com/labs/crop-fill/plugin.js"
              }
            }
          });

          // Video in the background
          wistiaEmbed = Wistia.embed(fullScreenVideo.backgroundvideo, videoOptions);
          // Video to be shown in the overlay

          /**
           * We load the thumbnail in the background while we wait
           * for the video to load and play. Once loaded, we pause, reset to
           * frame zero, show the video then play it.
           */
          wistiaEmbed.bind("play", function(){
            wistiaEmbed.pause();
            wistiaEmbed.time(0);
            $(fullScreenVideo.backgroundideoDiv).css('visibility', 'visible');
            wistiaEmbed.play();
            return this.unbind;
          });
        },
        /**
         * Plays the video set as overlayEmbed
         * @param None
        /**
         * Hide the overlay video and pause it. Also reshow
         * the text on the page.
         * @param None
         */
        /**
         * Fix the size of the images and text on page
         * @param None
         */
        fixTextPosition: function()
        {
          var width = $( window ).width();
          var height = $( window ).height();
          textWidth = $("#text").width();
          textHeight = $("#text").height();
          $("#video_container").css("width", width).css("height", height);
          $("#main-image").css("width", width).css("height", height);
          $("#text").css("left", (width/2) - (textWidth/2)).css("top", (height/2) - (textHeight/2));
        }

    }

    /**
     * When the doc is ready, fix the video and images sizes
     * then display the text on the page.
     */
    $(document).ready(function() {
      fullScreenVideo.fixTextPosition();
      $("#text").delay(200).animate({ opacity: 1 }, 650);
    });

    // If the widow is resized, resize the videos
    $(window).resize(fullScreenVideo.fixTextPosition);

    // When the play button is clicked, call the play function
    $(".rectangle").click(fullScreenVideo.playVideo);

    // When the "X" is clicked, exit the video
    $("#ex").click(fullScreenVideo.exitVideo);

    // Start loading the video
    fullScreenVideo.embedVideo();

  });
})(jQuery);

////////////////////////////////////////////////////////
// FUNCTION THAT WILL RUN CONTROL THE BUILT IN HEADER //
////////////////////////////////////////////////////////
$( document ).ready(function() {
  $('.header-ham').click(function(){
		$(this).toggleClass('open');
    $(".header-menu").slideToggle('fast');
	});
});

/////////////////////////////////////////////////////
// FUNCTION THAT WILL RUN CONTROL AVATAR USER MENU //
/////////////////////////////////////////////////////
$( document ).ready(function() {
  $('.user__avatar').click(function(){
		$('.user__dropdown').slideToggle('fast');
	});
});

(function($) {

  // Testimonials Carousel
  var testimonialCarousel = $("#testimonial-carousel");
  testimonialCarousel.slick({
    dots: true,
    adaptiveHeight: true,
    autoplay: true,
    autoplaySpeed: 5000,
    slidesToShow: 1,
    arrows: false
  });

})(jQuery);

////////////////////////////////////////////////////////
// FUNCTION THAT WILL RUN CONTROL THE BUILT IN HEADER //
////////////////////////////////////////////////////////
$(document).on("click", "a[href='#two-step']", function() {
  $("body").addClass("pop-open");
  $('html,body').scrollTop(0);
});
$( document ).ready(function() {
  $('.pop__overlay').click(function(){
    $("body").removeClass("pop-open");
    $(".pop").fadeOut('fast');
  });
  $('.pop__close').click(function(){
    $("body").removeClass("pop-open");
    $(".pop").fadeOut('fast');
  });
  ////////////////////////////////////////////////////////
  // PREVENTS SCROLLING OUTSIDES THE POP WHEN OPEN      //
  ////////////////////////////////////////////////////////
  $('.pop').on('mousewheel DOMMouseScroll', function(e) {
    var scrollTo = null;

    if(e.type === 'mousewheel') {
       scrollTo = (e.originalEvent.wheelDelta * -1);
    }
    else if(e.type === 'DOMMouseScroll') {
       scrollTo = 40 * e.originalEvent.detail;
    }

    if(scrollTo) {
       e.preventDefault();
       $(this).scrollTop(scrollTo + $(this).scrollTop());
    }
  });
});

$(window).load(function(){
  setTimeout(
  function()
  {
    $('.preloader').fadeOut('slow',function(){$(this).remove();});
  }, 100);
});

(function ($) {
  var $iframes = $(".section__body").find("iframe");
  $iframes.each(function (index) {
    var src = $(this).attr("src");
    if (
      src.indexOf("youtube") >= 0 ||
      src.indexOf("vimeo") >= 0 ||
      src.indexOf("wistia") >= 0 ||
      src.indexOf("ustream") >= 0 ||
      src.indexOf("dailymotion") >= 0
    ) {
      $("<div class='responsive-video' id='responsive-video-" + index + "'></div>").insertBefore($(this));
      $("<div class='video-container' id='video-container-" + index + "'></div>").insertBefore($("#responsive-video-" + index));
      $("#video-container-" + index).html($("#responsive-video-" + index));
      $("#responsive-video-" + index).html($(this));
    }
  });
  $(".video-container").css({
    "max-width": "640px"
  });
  $(".responsive-video").css({
    "position": "relative",
    "display": "block",
    "overflow": "hidden",
    "height": "0",
    "padding-bottom": "56.25%"
  });
  $(".responsive-video iframe").css({
    "position": "absolute",
    "top": "0",
    "bottom": "0",
    "left": "0",
    "width": "100%",
    "height": "100%",
    "border": "0",
    "background-color": "#000000"
  });
})(jQuery);

/////////////////////////////////////////////////////
// FUNCTION THAT WILL RUN CONTROL AVATAR USER MENU //
/////////////////////////////////////////////////////
$( document ).ready(function() {
  $('.search__toggle').click(function(){
		$('.section--search').slideToggle('fast');
	});
  $('.search__icon--close').click(function(){
		$('.section--search').slideToggle('fast');
	});
});

(function() {
  if(isFramed()) return;

  var exitPop = $("#exit-pop");
  var timedReveal = exitPop.data("timed-reveal") || 0;
  var cookieExpire = exitPop.data("cookie-expire") || 10;

  var aggressive = !!Kajabi.theme.previewThemeId;

  var bounce = ouibounce(document.getElementById("exit-pop"), {
    aggressive: aggressive,
    cookieExpire: cookieExpire,
    callback: function() {
      if ($("#exit-pop").length > 0 ) {
        $("body").addClass("pop-open");
        $('html,body').scrollTop(0);
      }
    }
  });

  if(timedReveal > 0) {
    setTimeout(function() {
      bounce.fire();
    }, timedReveal * 1000);
  }
})();

(function($) {
  $( ".btn-cta" ).each(function() {
    var ctaButton = $( this );
    var numSeconds = ctaButton.attr("data-num-seconds");
    if (numSeconds == 0) {
      ctaButton.css('display', 'inline-block');
    }
    else {
      ctaButton.css('display', 'none');
      setTimeout(function(){
        ctaButton.css('display', 'inline-block');
      }, numSeconds * 1000);
    }
  });
})(jQuery);

//////////////////////////
// メニューホバー時の動作 //
//////////////////////////
$(function(){
  console.log(1);
  $("#dropdownMenuButton").hover(
   function () {
   $(".dropdown").addClass("open");
   },
  );
});
$(function(){
  console.log(2);
  $(".dropdown-menu").hover(
   function () {
   $(".dropdown").addClass("open");
   },
   function () {
    $(".dropdown").removeClass("open"); 
   }
  );
});
///////////////////////////
// カスタムスクリプト slick//
///////////////////////////
$(function(){
  $('.syllabus_item_container').slick({
    arrows: true,
    infinite: true,
    slidesToShow: 5,
    slidesToScroll: 1,
    variableWidth: true,// スライド幅の自動計算を無効化
    responsive: [{
      breakpoint: 768,
      settings: {
        slidesToShow: 3
      }
    }, {
      breakpoint: 480,
      settings: {
        slidesToShow: 2
      }
    }]
  });
});

//! moment.js
//! version : 2.10.6
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com
!function(a,b){"object"==typeof exports&&"undefined"!=typeof module?module.exports=b():"function"==typeof define&&define.amd?define(b):a.moment=b()}(this,function(){"use strict";function a(){return Hc.apply(null,arguments)}function b(a){Hc=a}function c(a){return"[object Array]"===Object.prototype.toString.call(a)}function d(a){return a instanceof Date||"[object Date]"===Object.prototype.toString.call(a)}function e(a,b){var c,d=[];for(c=0;c<a.length;++c)d.push(b(a[c],c));return d}function f(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function g(a,b){for(var c in b)f(b,c)&&(a[c]=b[c]);return f(b,"toString")&&(a.toString=b.toString),f(b,"valueOf")&&(a.valueOf=b.valueOf),a}function h(a,b,c,d){return Ca(a,b,c,d,!0).utc()}function i(){return{empty:!1,unusedTokens:[],unusedInput:[],overflow:-2,charsLeftOver:0,nullInput:!1,invalidMonth:null,invalidFormat:!1,userInvalidated:!1,iso:!1}}function j(a){return null==a._pf&&(a._pf=i()),a._pf}function k(a){if(null==a._isValid){var b=j(a);a._isValid=!(isNaN(a._d.getTime())||!(b.overflow<0)||b.empty||b.invalidMonth||b.invalidWeekday||b.nullInput||b.invalidFormat||b.userInvalidated),a._strict&&(a._isValid=a._isValid&&0===b.charsLeftOver&&0===b.unusedTokens.length&&void 0===b.bigHour)}return a._isValid}function l(a){var b=h(NaN);return null!=a?g(j(b),a):j(b).userInvalidated=!0,b}function m(a,b){var c,d,e;if("undefined"!=typeof b._isAMomentObject&&(a._isAMomentObject=b._isAMomentObject),"undefined"!=typeof b._i&&(a._i=b._i),"undefined"!=typeof b._f&&(a._f=b._f),"undefined"!=typeof b._l&&(a._l=b._l),"undefined"!=typeof b._strict&&(a._strict=b._strict),"undefined"!=typeof b._tzm&&(a._tzm=b._tzm),"undefined"!=typeof b._isUTC&&(a._isUTC=b._isUTC),"undefined"!=typeof b._offset&&(a._offset=b._offset),"undefined"!=typeof b._pf&&(a._pf=j(b)),"undefined"!=typeof b._locale&&(a._locale=b._locale),Jc.length>0)for(c in Jc)d=Jc[c],e=b[d],"undefined"!=typeof e&&(a[d]=e);return a}function n(b){m(this,b),this._d=new Date(null!=b._d?b._d.getTime():NaN),Kc===!1&&(Kc=!0,a.updateOffset(this),Kc=!1)}function o(a){return a instanceof n||null!=a&&null!=a._isAMomentObject}function p(a){return 0>a?Math.ceil(a):Math.floor(a)}function q(a){var b=+a,c=0;return 0!==b&&isFinite(b)&&(c=p(b)),c}function r(a,b,c){var d,e=Math.min(a.length,b.length),f=Math.abs(a.length-b.length),g=0;for(d=0;e>d;d++)(c&&a[d]!==b[d]||!c&&q(a[d])!==q(b[d]))&&g++;return g+f}function s(){}function t(a){return a?a.toLowerCase().replace("_","-"):a}function u(a){for(var b,c,d,e,f=0;f<a.length;){for(e=t(a[f]).split("-"),b=e.length,c=t(a[f+1]),c=c?c.split("-"):null;b>0;){if(d=v(e.slice(0,b).join("-")))return d;if(c&&c.length>=b&&r(e,c,!0)>=b-1)break;b--}f++}return null}function v(a){var b=null;if(!Lc[a]&&"undefined"!=typeof module&&module&&module.exports)try{b=Ic._abbr,require("./locale/"+a),w(b)}catch(c){}return Lc[a]}function w(a,b){var c;return a&&(c="undefined"==typeof b?y(a):x(a,b),c&&(Ic=c)),Ic._abbr}function x(a,b){return null!==b?(b.abbr=a,Lc[a]=Lc[a]||new s,Lc[a].set(b),w(a),Lc[a]):(delete Lc[a],null)}function y(a){var b;if(a&&a._locale&&a._locale._abbr&&(a=a._locale._abbr),!a)return Ic;if(!c(a)){if(b=v(a))return b;a=[a]}return u(a)}function z(a,b){var c=a.toLowerCase();Mc[c]=Mc[c+"s"]=Mc[b]=a}function A(a){return"string"==typeof a?Mc[a]||Mc[a.toLowerCase()]:void 0}function B(a){var b,c,d={};for(c in a)f(a,c)&&(b=A(c),b&&(d[b]=a[c]));return d}function C(b,c){return function(d){return null!=d?(E(this,b,d),a.updateOffset(this,c),this):D(this,b)}}function D(a,b){return a._d["get"+(a._isUTC?"UTC":"")+b]()}function E(a,b,c){return a._d["set"+(a._isUTC?"UTC":"")+b](c)}function F(a,b){var c;if("object"==typeof a)for(c in a)this.set(c,a[c]);else if(a=A(a),"function"==typeof this[a])return this[a](b);return this}function G(a,b,c){var d=""+Math.abs(a),e=b-d.length,f=a>=0;return(f?c?"+":"":"-")+Math.pow(10,Math.max(0,e)).toString().substr(1)+d}function H(a,b,c,d){var e=d;"string"==typeof d&&(e=function(){return this[d]()}),a&&(Qc[a]=e),b&&(Qc[b[0]]=function(){return G(e.apply(this,arguments),b[1],b[2])}),c&&(Qc[c]=function(){return this.localeData().ordinal(e.apply(this,arguments),a)})}function I(a){return a.match(/\[[\s\S]/)?a.replace(/^\[|\]$/g,""):a.replace(/\\/g,"")}function J(a){var b,c,d=a.match(Nc);for(b=0,c=d.length;c>b;b++)Qc[d[b]]?d[b]=Qc[d[b]]:d[b]=I(d[b]);return function(e){var f="";for(b=0;c>b;b++)f+=d[b]instanceof Function?d[b].call(e,a):d[b];return f}}function K(a,b){return a.isValid()?(b=L(b,a.localeData()),Pc[b]=Pc[b]||J(b),Pc[b](a)):a.localeData().invalidDate()}function L(a,b){function c(a){return b.longDateFormat(a)||a}var d=5;for(Oc.lastIndex=0;d>=0&&Oc.test(a);)a=a.replace(Oc,c),Oc.lastIndex=0,d-=1;return a}function M(a){return"function"==typeof a&&"[object Function]"===Object.prototype.toString.call(a)}function N(a,b,c){dd[a]=M(b)?b:function(a){return a&&c?c:b}}function O(a,b){return f(dd,a)?dd[a](b._strict,b._locale):new RegExp(P(a))}function P(a){return a.replace("\\","").replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,function(a,b,c,d,e){return b||c||d||e}).replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")}function Q(a,b){var c,d=b;for("string"==typeof a&&(a=[a]),"number"==typeof b&&(d=function(a,c){c[b]=q(a)}),c=0;c<a.length;c++)ed[a[c]]=d}function R(a,b){Q(a,function(a,c,d,e){d._w=d._w||{},b(a,d._w,d,e)})}function S(a,b,c){null!=b&&f(ed,a)&&ed[a](b,c._a,c,a)}function T(a,b){return new Date(Date.UTC(a,b+1,0)).getUTCDate()}function U(a){return this._months[a.month()]}function V(a){return this._monthsShort[a.month()]}function W(a,b,c){var d,e,f;for(this._monthsParse||(this._monthsParse=[],this._longMonthsParse=[],this._shortMonthsParse=[]),d=0;12>d;d++){if(e=h([2e3,d]),c&&!this._longMonthsParse[d]&&(this._longMonthsParse[d]=new RegExp("^"+this.months(e,"").replace(".","")+"$","i"),this._shortMonthsParse[d]=new RegExp("^"+this.monthsShort(e,"").replace(".","")+"$","i")),c||this._monthsParse[d]||(f="^"+this.months(e,"")+"|^"+this.monthsShort(e,""),this._monthsParse[d]=new RegExp(f.replace(".",""),"i")),c&&"MMMM"===b&&this._longMonthsParse[d].test(a))return d;if(c&&"MMM"===b&&this._shortMonthsParse[d].test(a))return d;if(!c&&this._monthsParse[d].test(a))return d}}function X(a,b){var c;return"string"==typeof b&&(b=a.localeData().monthsParse(b),"number"!=typeof b)?a:(c=Math.min(a.date(),T(a.year(),b)),a._d["set"+(a._isUTC?"UTC":"")+"Month"](b,c),a)}function Y(b){return null!=b?(X(this,b),a.updateOffset(this,!0),this):D(this,"Month")}function Z(){return T(this.year(),this.month())}function $(a){var b,c=a._a;return c&&-2===j(a).overflow&&(b=c[gd]<0||c[gd]>11?gd:c[hd]<1||c[hd]>T(c[fd],c[gd])?hd:c[id]<0||c[id]>24||24===c[id]&&(0!==c[jd]||0!==c[kd]||0!==c[ld])?id:c[jd]<0||c[jd]>59?jd:c[kd]<0||c[kd]>59?kd:c[ld]<0||c[ld]>999?ld:-1,j(a)._overflowDayOfYear&&(fd>b||b>hd)&&(b=hd),j(a).overflow=b),a}function _(b){a.suppressDeprecationWarnings===!1&&"undefined"!=typeof console&&console.warn&&console.warn("Deprecation warning: "+b)}function aa(a,b){var c=!0;return g(function(){return c&&(_(a+"\n"+(new Error).stack),c=!1),b.apply(this,arguments)},b)}function ba(a,b){od[a]||(_(b),od[a]=!0)}function ca(a){var b,c,d=a._i,e=pd.exec(d);if(e){for(j(a).iso=!0,b=0,c=qd.length;c>b;b++)if(qd[b][1].exec(d)){a._f=qd[b][0];break}for(b=0,c=rd.length;c>b;b++)if(rd[b][1].exec(d)){a._f+=(e[6]||" ")+rd[b][0];break}d.match(ad)&&(a._f+="Z"),va(a)}else a._isValid=!1}function da(b){var c=sd.exec(b._i);return null!==c?void(b._d=new Date(+c[1])):(ca(b),void(b._isValid===!1&&(delete b._isValid,a.createFromInputFallback(b))))}function ea(a,b,c,d,e,f,g){var h=new Date(a,b,c,d,e,f,g);return 1970>a&&h.setFullYear(a),h}function fa(a){var b=new Date(Date.UTC.apply(null,arguments));return 1970>a&&b.setUTCFullYear(a),b}function ga(a){return ha(a)?366:365}function ha(a){return a%4===0&&a%100!==0||a%400===0}function ia(){return ha(this.year())}function ja(a,b,c){var d,e=c-b,f=c-a.day();return f>e&&(f-=7),e-7>f&&(f+=7),d=Da(a).add(f,"d"),{week:Math.ceil(d.dayOfYear()/7),year:d.year()}}function ka(a){return ja(a,this._week.dow,this._week.doy).week}function la(){return this._week.dow}function ma(){return this._week.doy}function na(a){var b=this.localeData().week(this);return null==a?b:this.add(7*(a-b),"d")}function oa(a){var b=ja(this,1,4).week;return null==a?b:this.add(7*(a-b),"d")}function pa(a,b,c,d,e){var f,g=6+e-d,h=fa(a,0,1+g),i=h.getUTCDay();return e>i&&(i+=7),c=null!=c?1*c:e,f=1+g+7*(b-1)-i+c,{year:f>0?a:a-1,dayOfYear:f>0?f:ga(a-1)+f}}function qa(a){var b=Math.round((this.clone().startOf("day")-this.clone().startOf("year"))/864e5)+1;return null==a?b:this.add(a-b,"d")}function ra(a,b,c){return null!=a?a:null!=b?b:c}function sa(a){var b=new Date;return a._useUTC?[b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate()]:[b.getFullYear(),b.getMonth(),b.getDate()]}function ta(a){var b,c,d,e,f=[];if(!a._d){for(d=sa(a),a._w&&null==a._a[hd]&&null==a._a[gd]&&ua(a),a._dayOfYear&&(e=ra(a._a[fd],d[fd]),a._dayOfYear>ga(e)&&(j(a)._overflowDayOfYear=!0),c=fa(e,0,a._dayOfYear),a._a[gd]=c.getUTCMonth(),a._a[hd]=c.getUTCDate()),b=0;3>b&&null==a._a[b];++b)a._a[b]=f[b]=d[b];for(;7>b;b++)a._a[b]=f[b]=null==a._a[b]?2===b?1:0:a._a[b];24===a._a[id]&&0===a._a[jd]&&0===a._a[kd]&&0===a._a[ld]&&(a._nextDay=!0,a._a[id]=0),a._d=(a._useUTC?fa:ea).apply(null,f),null!=a._tzm&&a._d.setUTCMinutes(a._d.getUTCMinutes()-a._tzm),a._nextDay&&(a._a[id]=24)}}function ua(a){var b,c,d,e,f,g,h;b=a._w,null!=b.GG||null!=b.W||null!=b.E?(f=1,g=4,c=ra(b.GG,a._a[fd],ja(Da(),1,4).year),d=ra(b.W,1),e=ra(b.E,1)):(f=a._locale._week.dow,g=a._locale._week.doy,c=ra(b.gg,a._a[fd],ja(Da(),f,g).year),d=ra(b.w,1),null!=b.d?(e=b.d,f>e&&++d):e=null!=b.e?b.e+f:f),h=pa(c,d,e,g,f),a._a[fd]=h.year,a._dayOfYear=h.dayOfYear}function va(b){if(b._f===a.ISO_8601)return void ca(b);b._a=[],j(b).empty=!0;var c,d,e,f,g,h=""+b._i,i=h.length,k=0;for(e=L(b._f,b._locale).match(Nc)||[],c=0;c<e.length;c++)f=e[c],d=(h.match(O(f,b))||[])[0],d&&(g=h.substr(0,h.indexOf(d)),g.length>0&&j(b).unusedInput.push(g),h=h.slice(h.indexOf(d)+d.length),k+=d.length),Qc[f]?(d?j(b).empty=!1:j(b).unusedTokens.push(f),S(f,d,b)):b._strict&&!d&&j(b).unusedTokens.push(f);j(b).charsLeftOver=i-k,h.length>0&&j(b).unusedInput.push(h),j(b).bigHour===!0&&b._a[id]<=12&&b._a[id]>0&&(j(b).bigHour=void 0),b._a[id]=wa(b._locale,b._a[id],b._meridiem),ta(b),$(b)}function wa(a,b,c){var d;return null==c?b:null!=a.meridiemHour?a.meridiemHour(b,c):null!=a.isPM?(d=a.isPM(c),d&&12>b&&(b+=12),d||12!==b||(b=0),b):b}function xa(a){var b,c,d,e,f;if(0===a._f.length)return j(a).invalidFormat=!0,void(a._d=new Date(NaN));for(e=0;e<a._f.length;e++)f=0,b=m({},a),null!=a._useUTC&&(b._useUTC=a._useUTC),b._f=a._f[e],va(b),k(b)&&(f+=j(b).charsLeftOver,f+=10*j(b).unusedTokens.length,j(b).score=f,(null==d||d>f)&&(d=f,c=b));g(a,c||b)}function ya(a){if(!a._d){var b=B(a._i);a._a=[b.year,b.month,b.day||b.date,b.hour,b.minute,b.second,b.millisecond],ta(a)}}function za(a){var b=new n($(Aa(a)));return b._nextDay&&(b.add(1,"d"),b._nextDay=void 0),b}function Aa(a){var b=a._i,e=a._f;return a._locale=a._locale||y(a._l),null===b||void 0===e&&""===b?l({nullInput:!0}):("string"==typeof b&&(a._i=b=a._locale.preparse(b)),o(b)?new n($(b)):(c(e)?xa(a):e?va(a):d(b)?a._d=b:Ba(a),a))}function Ba(b){var f=b._i;void 0===f?b._d=new Date:d(f)?b._d=new Date(+f):"string"==typeof f?da(b):c(f)?(b._a=e(f.slice(0),function(a){return parseInt(a,10)}),ta(b)):"object"==typeof f?ya(b):"number"==typeof f?b._d=new Date(f):a.createFromInputFallback(b)}function Ca(a,b,c,d,e){var f={};return"boolean"==typeof c&&(d=c,c=void 0),f._isAMomentObject=!0,f._useUTC=f._isUTC=e,f._l=c,f._i=a,f._f=b,f._strict=d,za(f)}function Da(a,b,c,d){return Ca(a,b,c,d,!1)}function Ea(a,b){var d,e;if(1===b.length&&c(b[0])&&(b=b[0]),!b.length)return Da();for(d=b[0],e=1;e<b.length;++e)(!b[e].isValid()||b[e][a](d))&&(d=b[e]);return d}function Fa(){var a=[].slice.call(arguments,0);return Ea("isBefore",a)}function Ga(){var a=[].slice.call(arguments,0);return Ea("isAfter",a)}function Ha(a){var b=B(a),c=b.year||0,d=b.quarter||0,e=b.month||0,f=b.week||0,g=b.day||0,h=b.hour||0,i=b.minute||0,j=b.second||0,k=b.millisecond||0;this._milliseconds=+k+1e3*j+6e4*i+36e5*h,this._days=+g+7*f,this._months=+e+3*d+12*c,this._data={},this._locale=y(),this._bubble()}function Ia(a){return a instanceof Ha}function Ja(a,b){H(a,0,0,function(){var a=this.utcOffset(),c="+";return 0>a&&(a=-a,c="-"),c+G(~~(a/60),2)+b+G(~~a%60,2)})}function Ka(a){var b=(a||"").match(ad)||[],c=b[b.length-1]||[],d=(c+"").match(xd)||["-",0,0],e=+(60*d[1])+q(d[2]);return"+"===d[0]?e:-e}function La(b,c){var e,f;return c._isUTC?(e=c.clone(),f=(o(b)||d(b)?+b:+Da(b))-+e,e._d.setTime(+e._d+f),a.updateOffset(e,!1),e):Da(b).local()}function Ma(a){return 15*-Math.round(a._d.getTimezoneOffset()/15)}function Na(b,c){var d,e=this._offset||0;return null!=b?("string"==typeof b&&(b=Ka(b)),Math.abs(b)<16&&(b=60*b),!this._isUTC&&c&&(d=Ma(this)),this._offset=b,this._isUTC=!0,null!=d&&this.add(d,"m"),e!==b&&(!c||this._changeInProgress?bb(this,Ya(b-e,"m"),1,!1):this._changeInProgress||(this._changeInProgress=!0,a.updateOffset(this,!0),this._changeInProgress=null)),this):this._isUTC?e:Ma(this)}function Oa(a,b){return null!=a?("string"!=typeof a&&(a=-a),this.utcOffset(a,b),this):-this.utcOffset()}function Pa(a){return this.utcOffset(0,a)}function Qa(a){return this._isUTC&&(this.utcOffset(0,a),this._isUTC=!1,a&&this.subtract(Ma(this),"m")),this}function Ra(){return this._tzm?this.utcOffset(this._tzm):"string"==typeof this._i&&this.utcOffset(Ka(this._i)),this}function Sa(a){return a=a?Da(a).utcOffset():0,(this.utcOffset()-a)%60===0}function Ta(){return this.utcOffset()>this.clone().month(0).utcOffset()||this.utcOffset()>this.clone().month(5).utcOffset()}function Ua(){if("undefined"!=typeof this._isDSTShifted)return this._isDSTShifted;var a={};if(m(a,this),a=Aa(a),a._a){var b=a._isUTC?h(a._a):Da(a._a);this._isDSTShifted=this.isValid()&&r(a._a,b.toArray())>0}else this._isDSTShifted=!1;return this._isDSTShifted}function Va(){return!this._isUTC}function Wa(){return this._isUTC}function Xa(){return this._isUTC&&0===this._offset}function Ya(a,b){var c,d,e,g=a,h=null;return Ia(a)?g={ms:a._milliseconds,d:a._days,M:a._months}:"number"==typeof a?(g={},b?g[b]=a:g.milliseconds=a):(h=yd.exec(a))?(c="-"===h[1]?-1:1,g={y:0,d:q(h[hd])*c,h:q(h[id])*c,m:q(h[jd])*c,s:q(h[kd])*c,ms:q(h[ld])*c}):(h=zd.exec(a))?(c="-"===h[1]?-1:1,g={y:Za(h[2],c),M:Za(h[3],c),d:Za(h[4],c),h:Za(h[5],c),m:Za(h[6],c),s:Za(h[7],c),w:Za(h[8],c)}):null==g?g={}:"object"==typeof g&&("from"in g||"to"in g)&&(e=_a(Da(g.from),Da(g.to)),g={},g.ms=e.milliseconds,g.M=e.months),d=new Ha(g),Ia(a)&&f(a,"_locale")&&(d._locale=a._locale),d}function Za(a,b){var c=a&&parseFloat(a.replace(",","."));return(isNaN(c)?0:c)*b}function $a(a,b){var c={milliseconds:0,months:0};return c.months=b.month()-a.month()+12*(b.year()-a.year()),a.clone().add(c.months,"M").isAfter(b)&&--c.months,c.milliseconds=+b-+a.clone().add(c.months,"M"),c}function _a(a,b){var c;return b=La(b,a),a.isBefore(b)?c=$a(a,b):(c=$a(b,a),c.milliseconds=-c.milliseconds,c.months=-c.months),c}function ab(a,b){return function(c,d){var e,f;return null===d||isNaN(+d)||(ba(b,"moment()."+b+"(period, number) is deprecated. Please use moment()."+b+"(number, period)."),f=c,c=d,d=f),c="string"==typeof c?+c:c,e=Ya(c,d),bb(this,e,a),this}}function bb(b,c,d,e){var f=c._milliseconds,g=c._days,h=c._months;e=null==e?!0:e,f&&b._d.setTime(+b._d+f*d),g&&E(b,"Date",D(b,"Date")+g*d),h&&X(b,D(b,"Month")+h*d),e&&a.updateOffset(b,g||h)}function cb(a,b){var c=a||Da(),d=La(c,this).startOf("day"),e=this.diff(d,"days",!0),f=-6>e?"sameElse":-1>e?"lastWeek":0>e?"lastDay":1>e?"sameDay":2>e?"nextDay":7>e?"nextWeek":"sameElse";return this.format(b&&b[f]||this.localeData().calendar(f,this,Da(c)))}function db(){return new n(this)}function eb(a,b){var c;return b=A("undefined"!=typeof b?b:"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+this>+a):(c=o(a)?+a:+Da(a),c<+this.clone().startOf(b))}function fb(a,b){var c;return b=A("undefined"!=typeof b?b:"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+a>+this):(c=o(a)?+a:+Da(a),+this.clone().endOf(b)<c)}function gb(a,b,c){return this.isAfter(a,c)&&this.isBefore(b,c)}function hb(a,b){var c;return b=A(b||"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+this===+a):(c=+Da(a),+this.clone().startOf(b)<=c&&c<=+this.clone().endOf(b))}function ib(a,b,c){var d,e,f=La(a,this),g=6e4*(f.utcOffset()-this.utcOffset());return b=A(b),"year"===b||"month"===b||"quarter"===b?(e=jb(this,f),"quarter"===b?e/=3:"year"===b&&(e/=12)):(d=this-f,e="second"===b?d/1e3:"minute"===b?d/6e4:"hour"===b?d/36e5:"day"===b?(d-g)/864e5:"week"===b?(d-g)/6048e5:d),c?e:p(e)}function jb(a,b){var c,d,e=12*(b.year()-a.year())+(b.month()-a.month()),f=a.clone().add(e,"months");return 0>b-f?(c=a.clone().add(e-1,"months"),d=(b-f)/(f-c)):(c=a.clone().add(e+1,"months"),d=(b-f)/(c-f)),-(e+d)}function kb(){return this.clone().locale("en").format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ")}function lb(){var a=this.clone().utc();return 0<a.year()&&a.year()<=9999?"function"==typeof Date.prototype.toISOString?this.toDate().toISOString():K(a,"YYYY-MM-DD[T]HH:mm:ss.SSS[Z]"):K(a,"YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]")}function mb(b){var c=K(this,b||a.defaultFormat);return this.localeData().postformat(c)}function nb(a,b){return this.isValid()?Ya({to:this,from:a}).locale(this.locale()).humanize(!b):this.localeData().invalidDate()}function ob(a){return this.from(Da(),a)}function pb(a,b){return this.isValid()?Ya({from:this,to:a}).locale(this.locale()).humanize(!b):this.localeData().invalidDate()}function qb(a){return this.to(Da(),a)}function rb(a){var b;return void 0===a?this._locale._abbr:(b=y(a),null!=b&&(this._locale=b),this)}function sb(){return this._locale}function tb(a){switch(a=A(a)){case"year":this.month(0);case"quarter":case"month":this.date(1);case"week":case"isoWeek":case"day":this.hours(0);case"hour":this.minutes(0);case"minute":this.seconds(0);case"second":this.milliseconds(0)}return"week"===a&&this.weekday(0),"isoWeek"===a&&this.isoWeekday(1),"quarter"===a&&this.month(3*Math.floor(this.month()/3)),this}function ub(a){return a=A(a),void 0===a||"millisecond"===a?this:this.startOf(a).add(1,"isoWeek"===a?"week":a).subtract(1,"ms")}function vb(){return+this._d-6e4*(this._offset||0)}function wb(){return Math.floor(+this/1e3)}function xb(){return this._offset?new Date(+this):this._d}function yb(){var a=this;return[a.year(),a.month(),a.date(),a.hour(),a.minute(),a.second(),a.millisecond()]}function zb(){var a=this;return{years:a.year(),months:a.month(),date:a.date(),hours:a.hours(),minutes:a.minutes(),seconds:a.seconds(),milliseconds:a.milliseconds()}}function Ab(){return k(this)}function Bb(){return g({},j(this))}function Cb(){return j(this).overflow}function Db(a,b){H(0,[a,a.length],0,b)}function Eb(a,b,c){return ja(Da([a,11,31+b-c]),b,c).week}function Fb(a){var b=ja(this,this.localeData()._week.dow,this.localeData()._week.doy).year;return null==a?b:this.add(a-b,"y")}function Gb(a){var b=ja(this,1,4).year;return null==a?b:this.add(a-b,"y")}function Hb(){return Eb(this.year(),1,4)}function Ib(){var a=this.localeData()._week;return Eb(this.year(),a.dow,a.doy)}function Jb(a){return null==a?Math.ceil((this.month()+1)/3):this.month(3*(a-1)+this.month()%3)}function Kb(a,b){return"string"!=typeof a?a:isNaN(a)?(a=b.weekdaysParse(a),"number"==typeof a?a:null):parseInt(a,10)}function Lb(a){return this._weekdays[a.day()]}function Mb(a){return this._weekdaysShort[a.day()]}function Nb(a){return this._weekdaysMin[a.day()]}function Ob(a){var b,c,d;for(this._weekdaysParse=this._weekdaysParse||[],b=0;7>b;b++)if(this._weekdaysParse[b]||(c=Da([2e3,1]).day(b),d="^"+this.weekdays(c,"")+"|^"+this.weekdaysShort(c,"")+"|^"+this.weekdaysMin(c,""),this._weekdaysParse[b]=new RegExp(d.replace(".",""),"i")),this._weekdaysParse[b].test(a))return b}function Pb(a){var b=this._isUTC?this._d.getUTCDay():this._d.getDay();return null!=a?(a=Kb(a,this.localeData()),this.add(a-b,"d")):b}function Qb(a){var b=(this.day()+7-this.localeData()._week.dow)%7;return null==a?b:this.add(a-b,"d")}function Rb(a){return null==a?this.day()||7:this.day(this.day()%7?a:a-7)}function Sb(a,b){H(a,0,0,function(){return this.localeData().meridiem(this.hours(),this.minutes(),b)})}function Tb(a,b){return b._meridiemParse}function Ub(a){return"p"===(a+"").toLowerCase().charAt(0)}function Vb(a,b,c){return a>11?c?"pm":"PM":c?"am":"AM"}function Wb(a,b){b[ld]=q(1e3*("0."+a))}function Xb(){return this._isUTC?"UTC":""}function Yb(){return this._isUTC?"Coordinated Universal Time":""}function Zb(a){return Da(1e3*a)}function $b(){return Da.apply(null,arguments).parseZone()}function _b(a,b,c){var d=this._calendar[a];return"function"==typeof d?d.call(b,c):d}function ac(a){var b=this._longDateFormat[a],c=this._longDateFormat[a.toUpperCase()];return b||!c?b:(this._longDateFormat[a]=c.replace(/MMMM|MM|DD|dddd/g,function(a){return a.slice(1)}),this._longDateFormat[a])}function bc(){return this._invalidDate}function cc(a){return this._ordinal.replace("%d",a)}function dc(a){return a}function ec(a,b,c,d){var e=this._relativeTime[c];return"function"==typeof e?e(a,b,c,d):e.replace(/%d/i,a)}function fc(a,b){var c=this._relativeTime[a>0?"future":"past"];return"function"==typeof c?c(b):c.replace(/%s/i,b)}function gc(a){var b,c;for(c in a)b=a[c],"function"==typeof b?this[c]=b:this["_"+c]=b;this._ordinalParseLenient=new RegExp(this._ordinalParse.source+"|"+/\d{1,2}/.source)}function hc(a,b,c,d){var e=y(),f=h().set(d,b);return e[c](f,a)}function ic(a,b,c,d,e){if("number"==typeof a&&(b=a,a=void 0),a=a||"",null!=b)return hc(a,b,c,e);var f,g=[];for(f=0;d>f;f++)g[f]=hc(a,f,c,e);return g}function jc(a,b){return ic(a,b,"months",12,"month")}function kc(a,b){return ic(a,b,"monthsShort",12,"month")}function lc(a,b){return ic(a,b,"weekdays",7,"day")}function mc(a,b){return ic(a,b,"weekdaysShort",7,"day")}function nc(a,b){return ic(a,b,"weekdaysMin",7,"day")}function oc(){var a=this._data;return this._milliseconds=Wd(this._milliseconds),this._days=Wd(this._days),this._months=Wd(this._months),a.milliseconds=Wd(a.milliseconds),a.seconds=Wd(a.seconds),a.minutes=Wd(a.minutes),a.hours=Wd(a.hours),a.months=Wd(a.months),a.years=Wd(a.years),this}function pc(a,b,c,d){var e=Ya(b,c);return a._milliseconds+=d*e._milliseconds,a._days+=d*e._days,a._months+=d*e._months,a._bubble()}function qc(a,b){return pc(this,a,b,1)}function rc(a,b){return pc(this,a,b,-1)}function sc(a){return 0>a?Math.floor(a):Math.ceil(a)}function tc(){var a,b,c,d,e,f=this._milliseconds,g=this._days,h=this._months,i=this._data;return f>=0&&g>=0&&h>=0||0>=f&&0>=g&&0>=h||(f+=864e5*sc(vc(h)+g),g=0,h=0),i.milliseconds=f%1e3,a=p(f/1e3),i.seconds=a%60,b=p(a/60),i.minutes=b%60,c=p(b/60),i.hours=c%24,g+=p(c/24),e=p(uc(g)),h+=e,g-=sc(vc(e)),d=p(h/12),h%=12,i.days=g,i.months=h,i.years=d,this}function uc(a){return 4800*a/146097}function vc(a){return 146097*a/4800}function wc(a){var b,c,d=this._milliseconds;if(a=A(a),"month"===a||"year"===a)return b=this._days+d/864e5,c=this._months+uc(b),"month"===a?c:c/12;switch(b=this._days+Math.round(vc(this._months)),a){case"week":return b/7+d/6048e5;case"day":return b+d/864e5;case"hour":return 24*b+d/36e5;case"minute":return 1440*b+d/6e4;case"second":return 86400*b+d/1e3;case"millisecond":return Math.floor(864e5*b)+d;default:throw new Error("Unknown unit "+a)}}function xc(){return this._milliseconds+864e5*this._days+this._months%12*2592e6+31536e6*q(this._months/12)}function yc(a){return function(){return this.as(a)}}function zc(a){return a=A(a),this[a+"s"]()}function Ac(a){return function(){return this._data[a]}}function Bc(){return p(this.days()/7)}function Cc(a,b,c,d,e){return e.relativeTime(b||1,!!c,a,d)}function Dc(a,b,c){var d=Ya(a).abs(),e=ke(d.as("s")),f=ke(d.as("m")),g=ke(d.as("h")),h=ke(d.as("d")),i=ke(d.as("M")),j=ke(d.as("y")),k=e<le.s&&["s",e]||1===f&&["m"]||f<le.m&&["mm",f]||1===g&&["h"]||g<le.h&&["hh",g]||1===h&&["d"]||h<le.d&&["dd",h]||1===i&&["M"]||i<le.M&&["MM",i]||1===j&&["y"]||["yy",j];return k[2]=b,k[3]=+a>0,k[4]=c,Cc.apply(null,k)}function Ec(a,b){return void 0===le[a]?!1:void 0===b?le[a]:(le[a]=b,!0)}function Fc(a){var b=this.localeData(),c=Dc(this,!a,b);return a&&(c=b.pastFuture(+this,c)),b.postformat(c)}function Gc(){var a,b,c,d=me(this._milliseconds)/1e3,e=me(this._days),f=me(this._months);a=p(d/60),b=p(a/60),d%=60,a%=60,c=p(f/12),f%=12;var g=c,h=f,i=e,j=b,k=a,l=d,m=this.asSeconds();return m?(0>m?"-":"")+"P"+(g?g+"Y":"")+(h?h+"M":"")+(i?i+"D":"")+(j||k||l?"T":"")+(j?j+"H":"")+(k?k+"M":"")+(l?l+"S":""):"P0D"}var Hc,Ic,Jc=a.momentProperties=[],Kc=!1,Lc={},Mc={},Nc=/(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g,Oc=/(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,Pc={},Qc={},Rc=/\d/,Sc=/\d\d/,Tc=/\d{3}/,Uc=/\d{4}/,Vc=/[+-]?\d{6}/,Wc=/\d\d?/,Xc=/\d{1,3}/,Yc=/\d{1,4}/,Zc=/[+-]?\d{1,6}/,$c=/\d+/,_c=/[+-]?\d+/,ad=/Z|[+-]\d\d:?\d\d/gi,bd=/[+-]?\d+(\.\d{1,3})?/,cd=/[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i,dd={},ed={},fd=0,gd=1,hd=2,id=3,jd=4,kd=5,ld=6;H("M",["MM",2],"Mo",function(){return this.month()+1}),H("MMM",0,0,function(a){return this.localeData().monthsShort(this,a)}),H("MMMM",0,0,function(a){return this.localeData().months(this,a)}),z("month","M"),N("M",Wc),N("MM",Wc,Sc),N("MMM",cd),N("MMMM",cd),Q(["M","MM"],function(a,b){b[gd]=q(a)-1}),Q(["MMM","MMMM"],function(a,b,c,d){var e=c._locale.monthsParse(a,d,c._strict);null!=e?b[gd]=e:j(c).invalidMonth=a});var md="January_February_March_April_May_June_July_August_September_October_November_December".split("_"),nd="Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),od={};a.suppressDeprecationWarnings=!1;var pd=/^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,qd=[["YYYYYY-MM-DD",/[+-]\d{6}-\d{2}-\d{2}/],["YYYY-MM-DD",/\d{4}-\d{2}-\d{2}/],["GGGG-[W]WW-E",/\d{4}-W\d{2}-\d/],["GGGG-[W]WW",/\d{4}-W\d{2}/],["YYYY-DDD",/\d{4}-\d{3}/]],rd=[["HH:mm:ss.SSSS",/(T| )\d\d:\d\d:\d\d\.\d+/],["HH:mm:ss",/(T| )\d\d:\d\d:\d\d/],["HH:mm",/(T| )\d\d:\d\d/],["HH",/(T| )\d\d/]],sd=/^\/?Date\((\-?\d+)/i;a.createFromInputFallback=aa("moment construction falls back to js Date. This is discouraged and will be removed in upcoming major release. Please refer to https://github.com/moment/moment/issues/1407 for more info.",function(a){a._d=new Date(a._i+(a._useUTC?" UTC":""))}),H(0,["YY",2],0,function(){return this.year()%100}),H(0,["YYYY",4],0,"year"),H(0,["YYYYY",5],0,"year"),H(0,["YYYYYY",6,!0],0,"year"),z("year","y"),N("Y",_c),N("YY",Wc,Sc),N("YYYY",Yc,Uc),N("YYYYY",Zc,Vc),N("YYYYYY",Zc,Vc),Q(["YYYYY","YYYYYY"],fd),Q("YYYY",function(b,c){c[fd]=2===b.length?a.parseTwoDigitYear(b):q(b)}),Q("YY",function(b,c){c[fd]=a.parseTwoDigitYear(b)}),a.parseTwoDigitYear=function(a){return q(a)+(q(a)>68?1900:2e3)};var td=C("FullYear",!1);H("w",["ww",2],"wo","week"),H("W",["WW",2],"Wo","isoWeek"),z("week","w"),z("isoWeek","W"),N("w",Wc),N("ww",Wc,Sc),N("W",Wc),N("WW",Wc,Sc),R(["w","ww","W","WW"],function(a,b,c,d){b[d.substr(0,1)]=q(a)});var ud={dow:0,doy:6};H("DDD",["DDDD",3],"DDDo","dayOfYear"),z("dayOfYear","DDD"),N("DDD",Xc),N("DDDD",Tc),Q(["DDD","DDDD"],function(a,b,c){c._dayOfYear=q(a)}),a.ISO_8601=function(){};var vd=aa("moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548",function(){var a=Da.apply(null,arguments);return this>a?this:a}),wd=aa("moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548",function(){var a=Da.apply(null,arguments);return a>this?this:a});Ja("Z",":"),Ja("ZZ",""),N("Z",ad),N("ZZ",ad),Q(["Z","ZZ"],function(a,b,c){c._useUTC=!0,c._tzm=Ka(a)});var xd=/([\+\-]|\d\d)/gi;a.updateOffset=function(){};var yd=/(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,zd=/^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/;Ya.fn=Ha.prototype;var Ad=ab(1,"add"),Bd=ab(-1,"subtract");a.defaultFormat="YYYY-MM-DDTHH:mm:ssZ";var Cd=aa("moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.",function(a){return void 0===a?this.localeData():this.locale(a)});H(0,["gg",2],0,function(){return this.weekYear()%100}),H(0,["GG",2],0,function(){return this.isoWeekYear()%100}),Db("gggg","weekYear"),Db("ggggg","weekYear"),Db("GGGG","isoWeekYear"),Db("GGGGG","isoWeekYear"),z("weekYear","gg"),z("isoWeekYear","GG"),N("G",_c),N("g",_c),N("GG",Wc,Sc),N("gg",Wc,Sc),N("GGGG",Yc,Uc),N("gggg",Yc,Uc),N("GGGGG",Zc,Vc),N("ggggg",Zc,Vc),R(["gggg","ggggg","GGGG","GGGGG"],function(a,b,c,d){b[d.substr(0,2)]=q(a)}),R(["gg","GG"],function(b,c,d,e){c[e]=a.parseTwoDigitYear(b)}),H("Q",0,0,"quarter"),z("quarter","Q"),N("Q",Rc),Q("Q",function(a,b){b[gd]=3*(q(a)-1)}),H("D",["DD",2],"Do","date"),z("date","D"),N("D",Wc),N("DD",Wc,Sc),N("Do",function(a,b){return a?b._ordinalParse:b._ordinalParseLenient}),Q(["D","DD"],hd),Q("Do",function(a,b){b[hd]=q(a.match(Wc)[0],10)});var Dd=C("Date",!0);H("d",0,"do","day"),H("dd",0,0,function(a){return this.localeData().weekdaysMin(this,a)}),H("ddd",0,0,function(a){return this.localeData().weekdaysShort(this,a)}),H("dddd",0,0,function(a){return this.localeData().weekdays(this,a)}),H("e",0,0,"weekday"),H("E",0,0,"isoWeekday"),z("day","d"),z("weekday","e"),z("isoWeekday","E"),N("d",Wc),N("e",Wc),N("E",Wc),N("dd",cd),N("ddd",cd),N("dddd",cd),R(["dd","ddd","dddd"],function(a,b,c){var d=c._locale.weekdaysParse(a);null!=d?b.d=d:j(c).invalidWeekday=a}),R(["d","e","E"],function(a,b,c,d){b[d]=q(a)});var Ed="Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),Fd="Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),Gd="Su_Mo_Tu_We_Th_Fr_Sa".split("_");H("H",["HH",2],0,"hour"),H("h",["hh",2],0,function(){return this.hours()%12||12}),Sb("a",!0),Sb("A",!1),z("hour","h"),N("a",Tb),N("A",Tb),N("H",Wc),N("h",Wc),N("HH",Wc,Sc),N("hh",Wc,Sc),Q(["H","HH"],id),Q(["a","A"],function(a,b,c){c._isPm=c._locale.isPM(a),c._meridiem=a}),Q(["h","hh"],function(a,b,c){b[id]=q(a),j(c).bigHour=!0});var Hd=/[ap]\.?m?\.?/i,Id=C("Hours",!0);H("m",["mm",2],0,"minute"),z("minute","m"),N("m",Wc),N("mm",Wc,Sc),Q(["m","mm"],jd);var Jd=C("Minutes",!1);H("s",["ss",2],0,"second"),z("second","s"),N("s",Wc),N("ss",Wc,Sc),Q(["s","ss"],kd);var Kd=C("Seconds",!1);H("S",0,0,function(){return~~(this.millisecond()/100)}),H(0,["SS",2],0,function(){return~~(this.millisecond()/10)}),H(0,["SSS",3],0,"millisecond"),H(0,["SSSS",4],0,function(){return 10*this.millisecond()}),H(0,["SSSSS",5],0,function(){return 100*this.millisecond()}),H(0,["SSSSSS",6],0,function(){return 1e3*this.millisecond()}),H(0,["SSSSSSS",7],0,function(){return 1e4*this.millisecond()}),H(0,["SSSSSSSS",8],0,function(){return 1e5*this.millisecond()}),H(0,["SSSSSSSSS",9],0,function(){return 1e6*this.millisecond()}),z("millisecond","ms"),N("S",Xc,Rc),N("SS",Xc,Sc),N("SSS",Xc,Tc);var Ld;for(Ld="SSSS";Ld.length<=9;Ld+="S")N(Ld,$c);for(Ld="S";Ld.length<=9;Ld+="S")Q(Ld,Wb);var Md=C("Milliseconds",!1);H("z",0,0,"zoneAbbr"),H("zz",0,0,"zoneName");var Nd=n.prototype;Nd.add=Ad,Nd.calendar=cb,Nd.clone=db,Nd.diff=ib,Nd.endOf=ub,Nd.format=mb,Nd.from=nb,Nd.fromNow=ob,Nd.to=pb,Nd.toNow=qb,Nd.get=F,Nd.invalidAt=Cb,Nd.isAfter=eb,Nd.isBefore=fb,Nd.isBetween=gb,Nd.isSame=hb,Nd.isValid=Ab,Nd.lang=Cd,Nd.locale=rb,Nd.localeData=sb,Nd.max=wd,Nd.min=vd,Nd.parsingFlags=Bb,Nd.set=F,Nd.startOf=tb,Nd.subtract=Bd,Nd.toArray=yb,Nd.toObject=zb,Nd.toDate=xb,Nd.toISOString=lb,Nd.toJSON=lb,Nd.toString=kb,Nd.unix=wb,Nd.valueOf=vb,Nd.year=td,Nd.isLeapYear=ia,Nd.weekYear=Fb,Nd.isoWeekYear=Gb,Nd.quarter=Nd.quarters=Jb,Nd.month=Y,Nd.daysInMonth=Z,Nd.week=Nd.weeks=na,Nd.isoWeek=Nd.isoWeeks=oa,Nd.weeksInYear=Ib,Nd.isoWeeksInYear=Hb,Nd.date=Dd,Nd.day=Nd.days=Pb,Nd.weekday=Qb,Nd.isoWeekday=Rb,Nd.dayOfYear=qa,Nd.hour=Nd.hours=Id,Nd.minute=Nd.minutes=Jd,Nd.second=Nd.seconds=Kd,
Nd.millisecond=Nd.milliseconds=Md,Nd.utcOffset=Na,Nd.utc=Pa,Nd.local=Qa,Nd.parseZone=Ra,Nd.hasAlignedHourOffset=Sa,Nd.isDST=Ta,Nd.isDSTShifted=Ua,Nd.isLocal=Va,Nd.isUtcOffset=Wa,Nd.isUtc=Xa,Nd.isUTC=Xa,Nd.zoneAbbr=Xb,Nd.zoneName=Yb,Nd.dates=aa("dates accessor is deprecated. Use date instead.",Dd),Nd.months=aa("months accessor is deprecated. Use month instead",Y),Nd.years=aa("years accessor is deprecated. Use year instead",td),Nd.zone=aa("moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779",Oa);var Od=Nd,Pd={sameDay:"[Today at] LT",nextDay:"[Tomorrow at] LT",nextWeek:"dddd [at] LT",lastDay:"[Yesterday at] LT",lastWeek:"[Last] dddd [at] LT",sameElse:"L"},Qd={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},Rd="Invalid date",Sd="%d",Td=/\d{1,2}/,Ud={future:"in %s",past:"%s ago",s:"a few seconds",m:"a minute",mm:"%d minutes",h:"an hour",hh:"%d hours",d:"a day",dd:"%d days",M:"a month",MM:"%d months",y:"a year",yy:"%d years"},Vd=s.prototype;Vd._calendar=Pd,Vd.calendar=_b,Vd._longDateFormat=Qd,Vd.longDateFormat=ac,Vd._invalidDate=Rd,Vd.invalidDate=bc,Vd._ordinal=Sd,Vd.ordinal=cc,Vd._ordinalParse=Td,Vd.preparse=dc,Vd.postformat=dc,Vd._relativeTime=Ud,Vd.relativeTime=ec,Vd.pastFuture=fc,Vd.set=gc,Vd.months=U,Vd._months=md,Vd.monthsShort=V,Vd._monthsShort=nd,Vd.monthsParse=W,Vd.week=ka,Vd._week=ud,Vd.firstDayOfYear=ma,Vd.firstDayOfWeek=la,Vd.weekdays=Lb,Vd._weekdays=Ed,Vd.weekdaysMin=Nb,Vd._weekdaysMin=Gd,Vd.weekdaysShort=Mb,Vd._weekdaysShort=Fd,Vd.weekdaysParse=Ob,Vd.isPM=Ub,Vd._meridiemParse=Hd,Vd.meridiem=Vb,w("en",{ordinalParse:/\d{1,2}(th|st|nd|rd)/,ordinal:function(a){var b=a%10,c=1===q(a%100/10)?"th":1===b?"st":2===b?"nd":3===b?"rd":"th";return a+c}}),a.lang=aa("moment.lang is deprecated. Use moment.locale instead.",w),a.langData=aa("moment.langData is deprecated. Use moment.localeData instead.",y);var Wd=Math.abs,Xd=yc("ms"),Yd=yc("s"),Zd=yc("m"),$d=yc("h"),_d=yc("d"),ae=yc("w"),be=yc("M"),ce=yc("y"),de=Ac("milliseconds"),ee=Ac("seconds"),fe=Ac("minutes"),ge=Ac("hours"),he=Ac("days"),ie=Ac("months"),je=Ac("years"),ke=Math.round,le={s:45,m:45,h:22,d:26,M:11},me=Math.abs,ne=Ha.prototype;ne.abs=oc,ne.add=qc,ne.subtract=rc,ne.as=wc,ne.asMilliseconds=Xd,ne.asSeconds=Yd,ne.asMinutes=Zd,ne.asHours=$d,ne.asDays=_d,ne.asWeeks=ae,ne.asMonths=be,ne.asYears=ce,ne.valueOf=xc,ne._bubble=tc,ne.get=zc,ne.milliseconds=de,ne.seconds=ee,ne.minutes=fe,ne.hours=ge,ne.days=he,ne.weeks=Bc,ne.months=ie,ne.years=je,ne.humanize=Fc,ne.toISOString=Gc,ne.toString=Gc,ne.toJSON=Gc,ne.locale=rb,ne.localeData=sb,ne.toIsoString=aa("toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)",Gc),ne.lang=Cd,H("X",0,0,"unix"),H("x",0,0,"valueOf"),N("x",_c),N("X",bd),Q("X",function(a,b,c){c._d=new Date(1e3*parseFloat(a,10))}),Q("x",function(a,b,c){c._d=new Date(q(a))}),a.version="2.10.6",b(Da),a.fn=Od,a.min=Fa,a.max=Ga,a.utc=h,a.unix=Zb,a.months=jc,a.isDate=d,a.locale=w,a.invalid=l,a.duration=Ya,a.isMoment=o,a.weekdays=lc,a.parseZone=$b,a.localeData=y,a.isDuration=Ia,a.monthsShort=kc,a.weekdaysMin=nc,a.defineLocale=x,a.weekdaysShort=mc,a.normalizeUnits=A,a.relativeTimeThreshold=Ec;var oe=a;return oe});

(function() {
  var $element = $(".track--active"),
  $parent = $(".player__playlist"),
  elementTop = $element.offset().top,
  elementHeight = $element.height(),
  viewportHeight = $parent.height(),
  scrollTop = elementTop - ((viewportHeight - elementHeight) / 2 + 250);
  $parent.scrollTop(scrollTop);
})();

//! moment-timezone.js
//! version : 0.4.1
//! author : Tim Wood
//! license : MIT
//! github.com/moment/moment-timezone
!function(a,b){"use strict";"function"==typeof define&&define.amd?define(["moment"],b):"object"==typeof exports?module.exports=b(require("moment")):b(a.moment)}(this,function(a){"use strict";function b(a){return a>96?a-87:a>64?a-29:a-48}function c(a){var c,d=0,e=a.split("."),f=e[0],g=e[1]||"",h=1,i=0,j=1;for(45===a.charCodeAt(0)&&(d=1,j=-1),d;d<f.length;d++)c=b(f.charCodeAt(d)),i=60*i+c;for(d=0;d<g.length;d++)h/=60,c=b(g.charCodeAt(d)),i+=c*h;return i*j}function d(a){for(var b=0;b<a.length;b++)a[b]=c(a[b])}function e(a,b){for(var c=0;b>c;c++)a[c]=Math.round((a[c-1]||0)+6e4*a[c]);a[b-1]=1/0}function f(a,b){var c,d=[];for(c=0;c<b.length;c++)d[c]=a[b[c]];return d}function g(a){var b=a.split("|"),c=b[2].split(" "),g=b[3].split(""),h=b[4].split(" ");return d(c),d(g),d(h),e(h,g.length),{name:b[0],abbrs:f(b[1].split(" "),g),offsets:f(c,g),untils:h}}function h(a){a&&this._set(g(a))}function i(a){return(a||"").toLowerCase().replace(/\//g,"_")}function j(a){var b,c,d;for("string"==typeof a&&(a=[a]),b=0;b<a.length;b++)c=a[b].split("|")[0],d=i(c),v[d]=a[b],x[d]=c}function k(a,b){a=i(a);var c,d=v[a];return d instanceof h?d:"string"==typeof d?(d=new h(d),v[a]=d,d):w[a]&&b!==k&&(c=k(w[a],k))?(d=v[a]=new h,d._set(c),d.name=x[a],d):null}function l(){var a,b=[];for(a in x)x.hasOwnProperty(a)&&(v[a]||v[w[a]])&&x[a]&&b.push(x[a]);return b.sort()}function m(a){var b,c,d,e;for("string"==typeof a&&(a=[a]),b=0;b<a.length;b++)c=a[b].split("|"),d=i(c[0]),e=i(c[1]),w[d]=e,x[d]=c[0],w[e]=d,x[e]=c[1]}function n(a){j(a.zones),m(a.links),r.dataVersion=a.version}function o(a){return o.didShowError||(o.didShowError=!0,q("moment.tz.zoneExists('"+a+"') has been deprecated in favor of !moment.tz.zone('"+a+"')")),!!k(a)}function p(a){return!(!a._a||void 0!==a._tzm)}function q(a){"undefined"!=typeof console&&"function"==typeof console.error&&console.error(a)}function r(b){var c=Array.prototype.slice.call(arguments,0,-1),d=arguments[arguments.length-1],e=k(d),f=a.utc.apply(null,c);return e&&!a.isMoment(b)&&p(f)&&f.add(e.parse(f),"minutes"),f.tz(d),f}function s(a){return function(){return this._z?this._z.abbr(this):a.call(this)}}function t(a){return function(){return this._z=null,a.apply(this,arguments)}}if(void 0!==a.tz)return q("Moment Timezone "+a.tz.version+" was already loaded "+(a.tz.dataVersion?"with data from ":"without any data")+a.tz.dataVersion),a;var u="0.4.1",v={},w={},x={},y=a.version.split("."),z=+y[0],A=+y[1];(2>z||2===z&&6>A)&&q("Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js "+a.version+". See momentjs.com"),h.prototype={_set:function(a){this.name=a.name,this.abbrs=a.abbrs,this.untils=a.untils,this.offsets=a.offsets},_index:function(a){var b,c=+a,d=this.untils;for(b=0;b<d.length;b++)if(c<d[b])return b},parse:function(a){var b,c,d,e,f=+a,g=this.offsets,h=this.untils,i=h.length-1;for(e=0;i>e;e++)if(b=g[e],c=g[e+1],d=g[e?e-1:e],c>b&&r.moveAmbiguousForward?b=c:b>d&&r.moveInvalidForward&&(b=d),f<h[e]-6e4*b)return g[e];return g[i]},abbr:function(a){return this.abbrs[this._index(a)]},offset:function(a){return this.offsets[this._index(a)]}},r.version=u,r.dataVersion="",r._zones=v,r._links=w,r._names=x,r.add=j,r.link=m,r.load=n,r.zone=k,r.zoneExists=o,r.names=l,r.Zone=h,r.unpack=g,r.unpackBase60=c,r.needsOffset=p,r.moveInvalidForward=!0,r.moveAmbiguousForward=!1;var B=a.fn;a.tz=r,a.defaultZone=null,a.updateOffset=function(b,c){var d,e=a.defaultZone;void 0===b._z&&(e&&p(b)&&!b._isUTC&&(b._d=a.utc(b._a)._d,b.utc().add(e.parse(b),"minutes")),b._z=e),b._z&&(d=b._z.offset(b),Math.abs(d)<16&&(d/=60),void 0!==b.utcOffset?b.utcOffset(-d,c):b.zone(d,c))},B.tz=function(b){return b?(this._z=k(b),this._z?a.updateOffset(this):q("Moment Timezone has no data for "+b+". See http://momentjs.com/timezone/docs/#/data-loading/."),this):this._z?this._z.name:void 0},B.zoneName=s(B.zoneName),B.zoneAbbr=s(B.zoneAbbr),B.utc=t(B.utc),a.tz.setDefault=function(b){return(2>z||2===z&&9>A)&&q("Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js "+a.version+"."),a.defaultZone=b?k(b):null,a};var C=a.momentProperties;return"[object Array]"===Object.prototype.toString.call(C)?(C.push("_z"),C.push("_a")):C&&(C._z=null),n({version:"2015g",zones:["Africa/Abidjan|GMT|0|0|","Africa/Addis_Ababa|EAT|-30|0|","Africa/Algiers|CET|-10|0|","Africa/Bangui|WAT|-10|0|","Africa/Blantyre|CAT|-20|0|","Africa/Cairo|EET EEST|-20 -30|010101010|1Cby0 Fb0 c10 8n0 8Nd0 gL0 e10 mn0","Africa/Casablanca|WET WEST|0 -10|01010101010101010101010101010101010101010|1Cco0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 Rc0 11A0 e00 e00 U00 11A0 8o0 e00 11A0","Africa/Ceuta|CET CEST|-10 -20|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Africa/Johannesburg|SAST|-20|0|","Africa/Tripoli|EET CET CEST|-20 -10 -20|0120|1IlA0 TA0 1o00","Africa/Windhoek|WAST WAT|-20 -10|01010101010101010101010|1C1c0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0","America/Adak|HST HDT|a0 90|01010101010101010101010|1BR00 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1BQX0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Anguilla|AST|40|0|","America/Araguaina|BRT BRST|30 20|010|1IdD0 Lz0","America/Argentina/Buenos_Aires|ART|30|0|","America/Asuncion|PYST PYT|30 40|01010101010101010101010|1C430 1a10 1fz0 1a10 1fz0 1cN0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0","America/Atikokan|EST|50|0|","America/Bahia|BRT BRST|30 20|010|1FJf0 Rb0","America/Bahia_Banderas|MST CDT CST|70 50 60|01212121212121212121212|1C1l0 1nW0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0","America/Belem|BRT|30|0|","America/Belize|CST|60|0|","America/Boa_Vista|AMT|40|0|","America/Bogota|COT|50|0|","America/Boise|MST MDT|70 60|01010101010101010101010|1BQV0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Campo_Grande|AMST AMT|30 40|01010101010101010101010|1BIr0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10","America/Cancun|CST CDT EST|60 50 50|010101010102|1C1k0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 Dd0","America/Caracas|VET|4u|0|","America/Cayenne|GFT|30|0|","America/Cayman|EST EDT|50 40|01010101010|1Qtj0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Chicago|CST CDT|60 50|01010101010101010101010|1BQU0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Chihuahua|MST MDT|70 60|01010101010101010101010|1C1l0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0","America/Creston|MST|70|0|","America/Dawson|PST PDT|80 70|01010101010101010101010|1BQW0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Detroit|EST EDT|50 40|01010101010101010101010|1BQT0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Eirunepe|AMT ACT|40 50|01|1KLE0","America/Fort_Nelson|PST PDT MST|80 70 70|010101010102|1BQW0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0","America/Glace_Bay|AST ADT|40 30|01010101010101010101010|1BQS0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Godthab|WGT WGST|30 20|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","America/Goose_Bay|AST ADT|40 30|01010101010101010101010|1BQQ1 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Grand_Turk|EST EDT AST|50 40 40|0101010101012|1BQT0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Guayaquil|ECT|50|0|","America/Guyana|GYT|40|0|","America/Havana|CST CDT|50 40|01010101010101010101010|1BQR0 1wo0 U00 1zc0 U00 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0","America/La_Paz|BOT|40|0|","America/Lima|PET|50|0|","America/Merida|CST CDT|60 50|01010101010101010101010|1C1k0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0","America/Metlakatla|PST|80|0|","America/Miquelon|PMST PMDT|30 20|01010101010101010101010|1BQR0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Montevideo|UYST UYT|20 30|010101010101|1BQQ0 1ld0 14n0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 11z0","America/Noronha|FNT|20|0|","America/North_Dakota/Beulah|MST MDT CST CDT|70 60 60 50|01232323232323232323232|1BQV0 1zb0 Oo0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Paramaribo|SRT|30|0|","America/Port-au-Prince|EST EDT|50 40|0101010101010101010|1GI70 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","America/Santa_Isabel|PST PDT|80 70|01010101010101010101010|1C1m0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0","America/Santiago|CLST CLT CLT|30 40 30|010101010102|1C1f0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 1wn0","America/Sao_Paulo|BRST BRT|20 30|01010101010101010101010|1BIq0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10","America/Scoresbysund|EGT EGST|10 0|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1BQPv 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0","Antarctica/Casey|CAST AWST|-b0 -80|0101|1BN30 40P0 KL0","Antarctica/Davis|DAVT DAVT|-50 -70|0101|1BPw0 3Wn0 KN0","Antarctica/DumontDUrville|DDUT|-a0|0|","Antarctica/Macquarie|AEDT MIST|-b0 -b0|01|1C140","Antarctica/Mawson|MAWT|-50|0|","Antarctica/McMurdo|NZDT NZST|-d0 -c0|01010101010101010101010|1C120 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00","Antarctica/Rothera|ROTT|30|0|","Antarctica/Syowa|SYOT|-30|0|","Antarctica/Troll|UTC CEST|0 -20|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Antarctica/Vostok|VOST|-60|0|","Asia/Aden|AST|-30|0|","Asia/Almaty|ALMT|-60|0|","Asia/Amman|EET EEST|-20 -30|010101010101010101010|1BVy0 1qM0 11A0 1o00 11A0 4bX0 Dd0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0","Asia/Anadyr|ANAT ANAST ANAT|-c0 -c0 -b0|0120|1BWe0 1qN0 WM0","Asia/Aqtau|AQTT|-50|0|","Asia/Ashgabat|TMT|-50|0|","Asia/Baku|AZT AZST|-40 -50|01010101010101010101010|1BWo0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Asia/Bangkok|ICT|-70|0|","Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1BWm0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0","Asia/Bishkek|KGT|-60|0|","Asia/Brunei|BNT|-80|0|","Asia/Calcutta|IST|-5u|0|","Asia/Chita|YAKT YAKST YAKT IRKT|-90 -a0 -a0 -80|01023|1BWh0 1qM0 WM0 8Hz0","Asia/Choibalsan|CHOT CHOST|-80 -90|0101010101010|1O8G0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0","Asia/Chongqing|CST|-80|0|","Asia/Dacca|BDT|-60|0|","Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1C0m0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0","Asia/Dili|TLT|-90|0|","Asia/Dubai|GST|-40|0|","Asia/Dushanbe|TJT|-50|0|","Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1BVW1 SKX 1xd1 MKX 1AN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1210 1nz0 14N0 1nz0 1210 1nz0 1210 1nz0 1210 1nz0","Asia/Hebron|EET EEST|-20 -30|0101010101010101010101010|1BVy0 Tb0 1xd1 MKX bB0 cn0 1cN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1210 1nz0 14N0 1nz0 1210 1nz0 1210 1nz0 1210 1nz0","Asia/Hong_Kong|HKT|-80|0|","Asia/Hovd|HOVT HOVST|-70 -80|0101010101010|1O8H0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0","Asia/Irkutsk|IRKT IRKST IRKT|-80 -90 -90|01020|1BWi0 1qM0 WM0 8Hz0","Asia/Istanbul|EET EEST|-20 -30|01010101010101010101010|1BWp0 1qM0 Xc0 1qo0 WM0 1qM0 11A0 1o00 1200 1nA0 11A0 1tA0 U00 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Asia/Jakarta|WIB|-70|0|","Asia/Jayapura|WIT|-90|0|","Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1BVA0 17X0 1kp0 1dz0 1c10 1aL0 1eN0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0","Asia/Kabul|AFT|-4u|0|","Asia/Kamchatka|PETT PETST PETT|-c0 -c0 -b0|0120|1BWe0 1qN0 WM0","Asia/Karachi|PKT|-50|0|","Asia/Kashgar|XJT|-60|0|","Asia/Kathmandu|NPT|-5J|0|","Asia/Khandyga|VLAT VLAST VLAT YAKT YAKT|-a0 -b0 -b0 -a0 -90|010234|1BWg0 1qM0 WM0 17V0 7zD0","Asia/Krasnoyarsk|KRAT KRAST KRAT|-70 -80 -80|01020|1BWj0 1qM0 WM0 8Hz0","Asia/Kuala_Lumpur|MYT|-80|0|","Asia/Magadan|MAGT MAGST MAGT MAGT|-b0 -c0 -c0 -a0|01023|1BWf0 1qM0 WM0 8Hz0","Asia/Makassar|WITA|-80|0|","Asia/Manila|PHT|-80|0|","Asia/Nicosia|EET EEST|-20 -30|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Asia/Novokuznetsk|KRAT NOVST NOVT NOVT|-70 -70 -60 -70|01230|1BWj0 1qN0 WM0 8Hz0","Asia/Novosibirsk|NOVT NOVST NOVT|-60 -70 -70|01020|1BWk0 1qM0 WM0 8Hz0","Asia/Omsk|OMST OMSST OMST|-60 -70 -70|01020|1BWk0 1qM0 WM0 8Hz0","Asia/Oral|ORAT|-50|0|","Asia/Pyongyang|KST KST|-90 -8u|01|1P4D0","Asia/Qyzylorda|QYZT|-60|0|","Asia/Rangoon|MMT|-6u|0|","Asia/Sakhalin|SAKT SAKST SAKT|-a0 -b0 -b0|01020|1BWg0 1qM0 WM0 8Hz0","Asia/Samarkand|UZT|-50|0|","Asia/Seoul|KST|-90|0|","Asia/Singapore|SGT|-80|0|","Asia/Srednekolymsk|MAGT MAGST MAGT SRET|-b0 -c0 -c0 -b0|01023|1BWf0 1qM0 WM0 8Hz0","Asia/Tbilisi|GET|-40|0|","Asia/Tehran|IRST IRDT|-3u -4u|01010101010101010101010|1BTUu 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0","Asia/Thimbu|BTT|-60|0|","Asia/Tokyo|JST|-90|0|","Asia/Ulaanbaatar|ULAT ULAST|-80 -90|0101010101010|1O8G0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0","Asia/Ust-Nera|MAGT MAGST MAGT VLAT VLAT|-b0 -c0 -c0 -b0 -a0|010234|1BWf0 1qM0 WM0 17V0 7zD0","Asia/Vladivostok|VLAT VLAST VLAT|-a0 -b0 -b0|01020|1BWg0 1qM0 WM0 8Hz0","Asia/Yakutsk|YAKT YAKST YAKT|-90 -a0 -a0|01020|1BWh0 1qM0 WM0 8Hz0","Asia/Yekaterinburg|YEKT YEKST YEKT|-50 -60 -60|01020|1BWl0 1qM0 WM0 8Hz0","Asia/Yerevan|AMT AMST|-40 -50|01010|1BWm0 1qM0 WM0 1qM0","Atlantic/Azores|AZOT AZOST|10 0|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Atlantic/Canary|WET WEST|0 -10|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Atlantic/Cape_Verde|CVT|10|0|","Atlantic/South_Georgia|GST|20|0|","Atlantic/Stanley|FKST FKT|30 40|010|1C6R0 U10","Australia/ACT|AEDT AEST|-b0 -a0|01010101010101010101010|1C140 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0","Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1C14u 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0","Australia/Brisbane|AEST|-a0|0|","Australia/Darwin|ACST|-9u|0|","Australia/Eucla|ACWST|-8J|0|","Australia/LHI|LHDT LHST|-b0 -au|01010101010101010101010|1C130 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu","Australia/Perth|AWST|-80|0|","Chile/EasterIsland|EASST EAST EAST|50 60 50|010101010102|1C1f0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 1wn0","Eire|GMT IST|0 -10|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Etc/GMT+1|GMT+1|10|0|","Etc/GMT+10|GMT+10|a0|0|","Etc/GMT+11|GMT+11|b0|0|","Etc/GMT+12|GMT+12|c0|0|","Etc/GMT+2|GMT+2|20|0|","Etc/GMT+3|GMT+3|30|0|","Etc/GMT+4|GMT+4|40|0|","Etc/GMT+5|GMT+5|50|0|","Etc/GMT+6|GMT+6|60|0|","Etc/GMT+7|GMT+7|70|0|","Etc/GMT+8|GMT+8|80|0|","Etc/GMT+9|GMT+9|90|0|","Etc/GMT-1|GMT-1|-10|0|","Etc/GMT-10|GMT-10|-a0|0|","Etc/GMT-11|GMT-11|-b0|0|","Etc/GMT-12|GMT-12|-c0|0|","Etc/GMT-13|GMT-13|-d0|0|","Etc/GMT-14|GMT-14|-e0|0|","Etc/GMT-2|GMT-2|-20|0|","Etc/GMT-3|GMT-3|-30|0|","Etc/GMT-4|GMT-4|-40|0|","Etc/GMT-5|GMT-5|-50|0|","Etc/GMT-6|GMT-6|-60|0|","Etc/GMT-7|GMT-7|-70|0|","Etc/GMT-8|GMT-8|-80|0|","Etc/GMT-9|GMT-9|-90|0|","Etc/UCT|UCT|0|0|","Etc/UTC|UTC|0|0|","Europe/Belfast|GMT BST|0 -10|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1BWo0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","Europe/Kaliningrad|EET EEST FET|-20 -30 -30|01020|1BWo0 1qM0 WM0 8Hz0","Europe/Minsk|EET EEST FET MSK|-20 -30 -30 -30|01023|1BWo0 1qM0 WM0 8Hy0","Europe/Moscow|MSK MSD MSK|-30 -40 -40|01020|1BWn0 1qM0 WM0 8Hz0","Europe/Samara|SAMT SAMST SAMT|-40 -40 -30|0120|1BWm0 1qN0 WM0","Europe/Simferopol|EET EEST MSK MSK|-20 -30 -40 -30|01010101023|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11z0 1nW0","HST|HST|a0|0|","Indian/Chagos|IOT|-60|0|","Indian/Christmas|CXT|-70|0|","Indian/Cocos|CCT|-6u|0|","Indian/Kerguelen|TFT|-50|0|","Indian/Mahe|SCT|-40|0|","Indian/Maldives|MVT|-50|0|","Indian/Mauritius|MUT|-40|0|","Indian/Reunion|RET|-40|0|","Kwajalein|MHT|-c0|0|","MET|MET MEST|-10 -20|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00","NZ-CHAT|CHADT CHAST|-dJ -cJ|01010101010101010101010|1C120 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00","Pacific/Apia|SST SDT WSDT WSST|b0 a0 -e0 -d0|01012323232323232323232|1Dbn0 1ff0 1a00 CI0 AQ0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00","Pacific/Bougainville|PGT BST|-a0 -b0|01|1NwE0","Pacific/Chuuk|CHUT|-a0|0|","Pacific/Efate|VUT|-b0|0|","Pacific/Enderbury|PHOT|-d0|0|","Pacific/Fakaofo|TKT TKT|b0 -d0|01|1Gfn0","Pacific/Fiji|FJST FJT|-d0 -c0|01010101010101010101010|1BWe0 1o00 Rc0 1wo0 Ao0 1Nc0 Ao0 1Q00 xz0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1SM0","Pacific/Funafuti|TVT|-c0|0|","Pacific/Galapagos|GALT|60|0|","Pacific/Gambier|GAMT|90|0|","Pacific/Guadalcanal|SBT|-b0|0|","Pacific/Guam|ChST|-a0|0|","Pacific/Kiritimati|LINT|-e0|0|","Pacific/Kosrae|KOST|-b0|0|","Pacific/Marquesas|MART|9u|0|","Pacific/Midway|SST|b0|0|","Pacific/Nauru|NRT|-c0|0|","Pacific/Niue|NUT|b0|0|","Pacific/Norfolk|NFT NFT|-bu -b0|01|1PoCu","Pacific/Noumea|NCT|-b0|0|","Pacific/Palau|PWT|-90|0|","Pacific/Pohnpei|PONT|-b0|0|","Pacific/Port_Moresby|PGT|-a0|0|","Pacific/Rarotonga|CKT|a0|0|","Pacific/Tahiti|TAHT|a0|0|","Pacific/Tarawa|GILT|-c0|0|","Pacific/Tongatapu|TOT|-d0|0|","Pacific/Wake|WAKT|-c0|0|","Pacific/Wallis|WFT|-c0|0|"],links:["Africa/Abidjan|Africa/Accra","Africa/Abidjan|Africa/Bamako","Africa/Abidjan|Africa/Banjul","Africa/Abidjan|Africa/Bissau","Africa/Abidjan|Africa/Conakry","Africa/Abidjan|Africa/Dakar","Africa/Abidjan|Africa/Freetown","Africa/Abidjan|Africa/Lome","Africa/Abidjan|Africa/Monrovia","Africa/Abidjan|Africa/Nouakchott","Africa/Abidjan|Africa/Ouagadougou","Africa/Abidjan|Africa/Sao_Tome","Africa/Abidjan|Africa/Timbuktu","Africa/Abidjan|America/Danmarkshavn","Africa/Abidjan|Atlantic/Reykjavik","Africa/Abidjan|Atlantic/St_Helena","Africa/Abidjan|Etc/GMT","Africa/Abidjan|Etc/GMT+0","Africa/Abidjan|Etc/GMT-0","Africa/Abidjan|Etc/GMT0","Africa/Abidjan|Etc/Greenwich","Africa/Abidjan|GMT","Africa/Abidjan|GMT+0","Africa/Abidjan|GMT-0","Africa/Abidjan|GMT0","Africa/Abidjan|Greenwich","Africa/Abidjan|Iceland","Africa/Addis_Ababa|Africa/Asmara","Africa/Addis_Ababa|Africa/Asmera","Africa/Addis_Ababa|Africa/Dar_es_Salaam","Africa/Addis_Ababa|Africa/Djibouti","Africa/Addis_Ababa|Africa/Juba","Africa/Addis_Ababa|Africa/Kampala","Africa/Addis_Ababa|Africa/Khartoum","Africa/Addis_Ababa|Africa/Mogadishu","Africa/Addis_Ababa|Africa/Nairobi","Africa/Addis_Ababa|Indian/Antananarivo","Africa/Addis_Ababa|Indian/Comoro","Africa/Addis_Ababa|Indian/Mayotte","Africa/Algiers|Africa/Tunis","Africa/Bangui|Africa/Brazzaville","Africa/Bangui|Africa/Douala","Africa/Bangui|Africa/Kinshasa","Africa/Bangui|Africa/Lagos","Africa/Bangui|Africa/Libreville","Africa/Bangui|Africa/Luanda","Africa/Bangui|Africa/Malabo","Africa/Bangui|Africa/Ndjamena","Africa/Bangui|Africa/Niamey","Africa/Bangui|Africa/Porto-Novo","Africa/Blantyre|Africa/Bujumbura","Africa/Blantyre|Africa/Gaborone","Africa/Blantyre|Africa/Harare","Africa/Blantyre|Africa/Kigali","Africa/Blantyre|Africa/Lubumbashi","Africa/Blantyre|Africa/Lusaka","Africa/Blantyre|Africa/Maputo","Africa/Cairo|Egypt","Africa/Casablanca|Africa/El_Aaiun","Africa/Ceuta|Arctic/Longyearbyen","Africa/Ceuta|Atlantic/Jan_Mayen","Africa/Ceuta|CET","Africa/Ceuta|Europe/Amsterdam","Africa/Ceuta|Europe/Andorra","Africa/Ceuta|Europe/Belgrade","Africa/Ceuta|Europe/Berlin","Africa/Ceuta|Europe/Bratislava","Africa/Ceuta|Europe/Brussels","Africa/Ceuta|Europe/Budapest","Africa/Ceuta|Europe/Busingen","Africa/Ceuta|Europe/Copenhagen","Africa/Ceuta|Europe/Gibraltar","Africa/Ceuta|Europe/Ljubljana","Africa/Ceuta|Europe/Luxembourg","Africa/Ceuta|Europe/Madrid","Africa/Ceuta|Europe/Malta","Africa/Ceuta|Europe/Monaco","Africa/Ceuta|Europe/Oslo","Africa/Ceuta|Europe/Paris","Africa/Ceuta|Europe/Podgorica","Africa/Ceuta|Europe/Prague","Africa/Ceuta|Europe/Rome","Africa/Ceuta|Europe/San_Marino","Africa/Ceuta|Europe/Sarajevo","Africa/Ceuta|Europe/Skopje","Africa/Ceuta|Europe/Stockholm","Africa/Ceuta|Europe/Tirane","Africa/Ceuta|Europe/Vaduz","Africa/Ceuta|Europe/Vatican","Africa/Ceuta|Europe/Vienna","Africa/Ceuta|Europe/Warsaw","Africa/Ceuta|Europe/Zagreb","Africa/Ceuta|Europe/Zurich","Africa/Ceuta|Poland","Africa/Johannesburg|Africa/Maseru","Africa/Johannesburg|Africa/Mbabane","Africa/Tripoli|Libya","America/Adak|America/Atka","America/Adak|US/Aleutian","America/Anchorage|America/Juneau","America/Anchorage|America/Nome","America/Anchorage|America/Sitka","America/Anchorage|America/Yakutat","America/Anchorage|US/Alaska","America/Anguilla|America/Antigua","America/Anguilla|America/Aruba","America/Anguilla|America/Barbados","America/Anguilla|America/Blanc-Sablon","America/Anguilla|America/Curacao","America/Anguilla|America/Dominica","America/Anguilla|America/Grenada","America/Anguilla|America/Guadeloupe","America/Anguilla|America/Kralendijk","America/Anguilla|America/Lower_Princes","America/Anguilla|America/Marigot","America/Anguilla|America/Martinique","America/Anguilla|America/Montserrat","America/Anguilla|America/Port_of_Spain","America/Anguilla|America/Puerto_Rico","America/Anguilla|America/Santo_Domingo","America/Anguilla|America/St_Barthelemy","America/Anguilla|America/St_Kitts","America/Anguilla|America/St_Lucia","America/Anguilla|America/St_Thomas","America/Anguilla|America/St_Vincent","America/Anguilla|America/Tortola","America/Anguilla|America/Virgin","America/Argentina/Buenos_Aires|America/Argentina/Catamarca","America/Argentina/Buenos_Aires|America/Argentina/ComodRivadavia","America/Argentina/Buenos_Aires|America/Argentina/Cordoba","America/Argentina/Buenos_Aires|America/Argentina/Jujuy","America/Argentina/Buenos_Aires|America/Argentina/La_Rioja","America/Argentina/Buenos_Aires|America/Argentina/Mendoza","America/Argentina/Buenos_Aires|America/Argentina/Rio_Gallegos","America/Argentina/Buenos_Aires|America/Argentina/Salta","America/Argentina/Buenos_Aires|America/Argentina/San_Juan","America/Argentina/Buenos_Aires|America/Argentina/San_Luis","America/Argentina/Buenos_Aires|America/Argentina/Tucuman","America/Argentina/Buenos_Aires|America/Argentina/Ushuaia","America/Argentina/Buenos_Aires|America/Buenos_Aires","America/Argentina/Buenos_Aires|America/Catamarca","America/Argentina/Buenos_Aires|America/Cordoba","America/Argentina/Buenos_Aires|America/Jujuy","America/Argentina/Buenos_Aires|America/Mendoza","America/Argentina/Buenos_Aires|America/Rosario","America/Atikokan|America/Coral_Harbour","America/Atikokan|America/Jamaica","America/Atikokan|America/Panama","America/Atikokan|EST","America/Atikokan|Jamaica","America/Belem|America/Fortaleza","America/Belem|America/Maceio","America/Belem|America/Recife","America/Belem|America/Santarem","America/Belize|America/Costa_Rica","America/Belize|America/El_Salvador","America/Belize|America/Guatemala","America/Belize|America/Managua","America/Belize|America/Regina","America/Belize|America/Swift_Current","America/Belize|America/Tegucigalpa","America/Belize|Canada/East-Saskatchewan","America/Belize|Canada/Saskatchewan","America/Boa_Vista|America/Manaus","America/Boa_Vista|America/Porto_Velho","America/Boa_Vista|Brazil/West","America/Boise|America/Cambridge_Bay","America/Boise|America/Denver","America/Boise|America/Edmonton","America/Boise|America/Inuvik","America/Boise|America/Ojinaga","America/Boise|America/Shiprock","America/Boise|America/Yellowknife","America/Boise|Canada/Mountain","America/Boise|MST7MDT","America/Boise|Navajo","America/Boise|US/Mountain","America/Campo_Grande|America/Cuiaba","America/Chicago|America/Indiana/Knox","America/Chicago|America/Indiana/Tell_City","America/Chicago|America/Knox_IN","America/Chicago|America/Matamoros","America/Chicago|America/Menominee","America/Chicago|America/North_Dakota/Center","America/Chicago|America/North_Dakota/New_Salem","America/Chicago|America/Rainy_River","America/Chicago|America/Rankin_Inlet","America/Chicago|America/Resolute","America/Chicago|America/Winnipeg","America/Chicago|CST6CDT","America/Chicago|Canada/Central","America/Chicago|US/Central","America/Chicago|US/Indiana-Starke","America/Chihuahua|America/Mazatlan","America/Chihuahua|Mexico/BajaSur","America/Creston|America/Dawson_Creek","America/Creston|America/Hermosillo","America/Creston|America/Phoenix","America/Creston|MST","America/Creston|US/Arizona","America/Dawson|America/Ensenada","America/Dawson|America/Los_Angeles","America/Dawson|America/Tijuana","America/Dawson|America/Vancouver","America/Dawson|America/Whitehorse","America/Dawson|Canada/Pacific","America/Dawson|Canada/Yukon","America/Dawson|Mexico/BajaNorte","America/Dawson|PST8PDT","America/Dawson|US/Pacific","America/Dawson|US/Pacific-New","America/Detroit|America/Fort_Wayne","America/Detroit|America/Indiana/Indianapolis","America/Detroit|America/Indiana/Marengo","America/Detroit|America/Indiana/Petersburg","America/Detroit|America/Indiana/Vevay","America/Detroit|America/Indiana/Vincennes","America/Detroit|America/Indiana/Winamac","America/Detroit|America/Indianapolis","America/Detroit|America/Iqaluit","America/Detroit|America/Kentucky/Louisville","America/Detroit|America/Kentucky/Monticello","America/Detroit|America/Louisville","America/Detroit|America/Montreal","America/Detroit|America/Nassau","America/Detroit|America/New_York","America/Detroit|America/Nipigon","America/Detroit|America/Pangnirtung","America/Detroit|America/Thunder_Bay","America/Detroit|America/Toronto","America/Detroit|Canada/Eastern","America/Detroit|EST5EDT","America/Detroit|US/East-Indiana","America/Detroit|US/Eastern","America/Detroit|US/Michigan","America/Eirunepe|America/Porto_Acre","America/Eirunepe|America/Rio_Branco","America/Eirunepe|Brazil/Acre","America/Glace_Bay|America/Halifax","America/Glace_Bay|America/Moncton","America/Glace_Bay|America/Thule","America/Glace_Bay|Atlantic/Bermuda","America/Glace_Bay|Canada/Atlantic","America/Havana|Cuba","America/Merida|America/Mexico_City","America/Merida|America/Monterrey","America/Merida|Mexico/General","America/Metlakatla|Pacific/Pitcairn","America/Noronha|Brazil/DeNoronha","America/Santiago|Antarctica/Palmer","America/Santiago|Chile/Continental","America/Sao_Paulo|Brazil/East","America/St_Johns|Canada/Newfoundland","Antarctica/McMurdo|Antarctica/South_Pole","Antarctica/McMurdo|NZ","Antarctica/McMurdo|Pacific/Auckland","Asia/Aden|Asia/Baghdad","Asia/Aden|Asia/Bahrain","Asia/Aden|Asia/Kuwait","Asia/Aden|Asia/Qatar","Asia/Aden|Asia/Riyadh","Asia/Aqtau|Asia/Aqtobe","Asia/Ashgabat|Asia/Ashkhabad","Asia/Bangkok|Asia/Ho_Chi_Minh","Asia/Bangkok|Asia/Phnom_Penh","Asia/Bangkok|Asia/Saigon","Asia/Bangkok|Asia/Vientiane","Asia/Calcutta|Asia/Colombo","Asia/Calcutta|Asia/Kolkata","Asia/Chongqing|Asia/Chungking","Asia/Chongqing|Asia/Harbin","Asia/Chongqing|Asia/Macao","Asia/Chongqing|Asia/Macau","Asia/Chongqing|Asia/Shanghai","Asia/Chongqing|Asia/Taipei","Asia/Chongqing|PRC","Asia/Chongqing|ROC","Asia/Dacca|Asia/Dhaka","Asia/Dubai|Asia/Muscat","Asia/Hong_Kong|Hongkong","Asia/Istanbul|Europe/Istanbul","Asia/Istanbul|Turkey","Asia/Jakarta|Asia/Pontianak","Asia/Jerusalem|Asia/Tel_Aviv","Asia/Jerusalem|Israel","Asia/Kashgar|Asia/Urumqi","Asia/Kathmandu|Asia/Katmandu","Asia/Kuala_Lumpur|Asia/Kuching","Asia/Makassar|Asia/Ujung_Pandang","Asia/Nicosia|EET","Asia/Nicosia|Europe/Athens","Asia/Nicosia|Europe/Bucharest","Asia/Nicosia|Europe/Helsinki","Asia/Nicosia|Europe/Kiev","Asia/Nicosia|Europe/Mariehamn","Asia/Nicosia|Europe/Nicosia","Asia/Nicosia|Europe/Riga","Asia/Nicosia|Europe/Sofia","Asia/Nicosia|Europe/Tallinn","Asia/Nicosia|Europe/Uzhgorod","Asia/Nicosia|Europe/Vilnius","Asia/Nicosia|Europe/Zaporozhye","Asia/Samarkand|Asia/Tashkent","Asia/Seoul|ROK","Asia/Singapore|Singapore","Asia/Tehran|Iran","Asia/Thimbu|Asia/Thimphu","Asia/Tokyo|Japan","Asia/Ulaanbaatar|Asia/Ulan_Bator","Atlantic/Canary|Atlantic/Faeroe","Atlantic/Canary|Atlantic/Faroe","Atlantic/Canary|Atlantic/Madeira","Atlantic/Canary|Europe/Lisbon","Atlantic/Canary|Portugal","Atlantic/Canary|WET","Australia/ACT|Australia/Canberra","Australia/ACT|Australia/Currie","Australia/ACT|Australia/Hobart","Australia/ACT|Australia/Melbourne","Australia/ACT|Australia/NSW","Australia/ACT|Australia/Sydney","Australia/ACT|Australia/Tasmania","Australia/ACT|Australia/Victoria","Australia/Adelaide|Australia/Broken_Hill","Australia/Adelaide|Australia/South","Australia/Adelaide|Australia/Yancowinna","Australia/Brisbane|Australia/Lindeman","Australia/Brisbane|Australia/Queensland","Australia/Darwin|Australia/North","Australia/LHI|Australia/Lord_Howe","Australia/Perth|Australia/West","Chile/EasterIsland|Pacific/Easter","Eire|Europe/Dublin","Etc/UCT|UCT","Etc/UTC|Etc/Universal","Etc/UTC|Etc/Zulu","Etc/UTC|UTC","Etc/UTC|Universal","Etc/UTC|Zulu","Europe/Belfast|Europe/Guernsey","Europe/Belfast|Europe/Isle_of_Man","Europe/Belfast|Europe/Jersey","Europe/Belfast|Europe/London","Europe/Belfast|GB","Europe/Belfast|GB-Eire","Europe/Chisinau|Europe/Tiraspol","Europe/Moscow|Europe/Volgograd","Europe/Moscow|W-SU","HST|Pacific/Honolulu","HST|Pacific/Johnston","HST|US/Hawaii","Kwajalein|Pacific/Kwajalein","Kwajalein|Pacific/Majuro","NZ-CHAT|Pacific/Chatham","Pacific/Chuuk|Pacific/Truk","Pacific/Chuuk|Pacific/Yap","Pacific/Guam|Pacific/Saipan","Pacific/Midway|Pacific/Pago_Pago","Pacific/Midway|Pacific/Samoa","Pacific/Midway|US/Samoa","Pacific/Pohnpei|Pacific/Ponape"]}),a});

/*!
 * The Final Countdown for jQuery v2.1.0 (http://hilios.github.io/jQuery.countdown/)
 * Copyright (c) 2015 Edson Hilios
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
!function(a){"use strict";"function"==typeof define&&define.amd?define(["jquery"],a):a(jQuery)}(function(a){"use strict";function b(a){if(a instanceof Date)return a;if(String(a).match(g))return String(a).match(/^[0-9]*$/)&&(a=Number(a)),String(a).match(/\-/)&&(a=String(a).replace(/\-/g,"/")),new Date(a);throw new Error("Couldn't cast `"+a+"` to a date object.")}function c(a){var b=a.toString().replace(/([.?*+^$[\]\\(){}|-])/g,"\\$1");return new RegExp(b)}function d(a){return function(b){var d=b.match(/%(-|!)?[A-Z]{1}(:[^;]+;)?/gi);if(d)for(var f=0,g=d.length;g>f;++f){var h=d[f].match(/%(-|!)?([a-zA-Z]{1})(:[^;]+;)?/),j=c(h[0]),k=h[1]||"",l=h[3]||"",m=null;h=h[2],i.hasOwnProperty(h)&&(m=i[h],m=Number(a[m])),null!==m&&("!"===k&&(m=e(l,m)),""===k&&10>m&&(m="0"+m.toString()),b=b.replace(j,m.toString()))}return b=b.replace(/%%/,"%")}}function e(a,b){var c="s",d="";return a&&(a=a.replace(/(:|;|\s)/gi,"").split(/\,/),1===a.length?c=a[0]:(d=a[0],c=a[1])),1===Math.abs(b)?d:c}var f=[],g=[],h={precision:100,elapse:!1};g.push(/^[0-9]*$/.source),g.push(/([0-9]{1,2}\/){2}[0-9]{4}( [0-9]{1,2}(:[0-9]{2}){2})?/.source),g.push(/[0-9]{4}([\/\-][0-9]{1,2}){2}( [0-9]{1,2}(:[0-9]{2}){2})?/.source),g=new RegExp(g.join("|"));var i={Y:"years",m:"months",n:"daysToMonth",w:"weeks",d:"daysToWeek",D:"totalDays",H:"hours",M:"minutes",S:"seconds"},j=function(b,c,d){this.el=b,this.$el=a(b),this.interval=null,this.offset={},this.options=a.extend({},h),this.instanceNumber=f.length,f.push(this),this.$el.data("countdown-instance",this.instanceNumber),d&&("function"==typeof d?(this.$el.on("update.countdown",d),this.$el.on("stoped.countdown",d),this.$el.on("finish.countdown",d)):this.options=a.extend({},h,d)),this.setFinalDate(c),this.start()};a.extend(j.prototype,{start:function(){null!==this.interval&&clearInterval(this.interval);var a=this;this.update(),this.interval=setInterval(function(){a.update.call(a)},this.options.precision)},stop:function(){clearInterval(this.interval),this.interval=null,this.dispatchEvent("stoped")},toggle:function(){this.interval?this.stop():this.start()},pause:function(){this.stop()},resume:function(){this.start()},remove:function(){this.stop.call(this),f[this.instanceNumber]=null,delete this.$el.data().countdownInstance},setFinalDate:function(a){this.finalDate=b(a)},update:function(){if(0===this.$el.closest("html").length)return void this.remove();var b,c=void 0!==a._data(this.el,"events"),d=new Date;b=this.finalDate.getTime()-d.getTime(),b=Math.ceil(b/1e3),b=!this.options.elapse&&0>b?0:Math.abs(b),this.totalSecsLeft!==b&&c&&(this.totalSecsLeft=b,this.elapsed=d>=this.finalDate,this.offset={seconds:this.totalSecsLeft%60,minutes:Math.floor(this.totalSecsLeft/60)%60,hours:Math.floor(this.totalSecsLeft/60/60)%24,days:Math.floor(this.totalSecsLeft/60/60/24)%7,daysToWeek:Math.floor(this.totalSecsLeft/60/60/24)%7,daysToMonth:Math.floor(this.totalSecsLeft/60/60/24%30.4368),totalDays:Math.floor(this.totalSecsLeft/60/60/24),weeks:Math.floor(this.totalSecsLeft/60/60/24/7),months:Math.floor(this.totalSecsLeft/60/60/24/30.4368),years:Math.abs(this.finalDate.getFullYear()-d.getFullYear())},this.options.elapse||0!==this.totalSecsLeft?this.dispatchEvent("update"):(this.stop(),this.dispatchEvent("finish")))},dispatchEvent:function(b){var c=a.Event(b+".countdown");c.finalDate=this.finalDate,c.elapsed=this.elapsed,c.offset=a.extend({},this.offset),c.strftime=d(this.offset),this.$el.trigger(c)}}),a.fn.countdown=function(){var b=Array.prototype.slice.call(arguments,0);return this.each(function(){var c=a(this).data("countdown-instance");if(void 0!==c){var d=f[c],e=b[0];j.prototype.hasOwnProperty(e)?d[e].apply(d,b.slice(1)):null===String(e).match(/^[$A-Z_][0-9A-Z_$]*$/i)?(d.setFinalDate.call(d,e),d.start()):a.error("Method %s does not exist on jQuery.countdown".replace(/\%s/gi,e))}else new j(this,b[0],b[1])})}});

(function($) {
  $( ".countdown" ).each(function() {
    var $timer = $( this );
    if ($timer.size() > 0) {
      var timeEnd = moment.tz($timer.attr("data-end-time"), $timer.attr("data-timezone"));
      $timer.countdown(timeEnd.toDate(), function(event) {
        $timer.find( ".days").text(event.strftime('%D'));
        $timer.find(".hours").text(event.strftime('%H'));
        $timer.find(".minutes").text(event.strftime('%M'));
        $timer.find(".seconds").text(event.strftime('%S'));
      });
    }
  });
})(jQuery);

(function() {

  $( ".btn--completion" ).click(function() {
    var postCompletion = $(this).data('post-completion-toggle');
    var nextPage = $(this).data('page');
    if (postCompletion == false){
      if (nextPage == ""){
        $("#upsell-pop").fadeIn();
      }
    }
  });

  if (document.getElementsByClassName('wistia_embed').length == 0) return false;

  var videoID = document.getElementsByClassName('wistia_embed')[0].id;
  var $scrim = $(".coming-up");
  var counter = $(".coming-up").data('counter');
  var width = 0;
  var id;
  var nextPage = $(".coming-up").data('page');

  window._wq = window._wq || [];
  _wq.push({ id: videoID, onReady: function(video) {

    video.bind("end", function() {
      $("#upsell-pop").fadeIn();
      if (nextPage != null){
        $scrim.fadeIn("fast");
        startCountdown();
      }
    });

  }});

  function startCountdown() {
    id = setInterval(function() {
      counter--;
      width+=5;
      if(counter < 0) {
        clearInterval(id);
        window.location.href = nextPage;
      } else {
        $(".ticker").text( counter.toString() );
        $(".coming-up__progress-bar").width( width +"%" );
      }
      $(".coming-up__cancel").on("click", function() {
        clearInterval(id);
        counter = 20;
        width = 0;
        $(".ticker").text( counter.toString() );
        $(".coming-up__progress-bar").width( width +"%" );
        $scrim.fadeOut("fast");
      });
    }, 1000);
  }
})(jQuery);
