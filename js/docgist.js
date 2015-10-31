'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = 'github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc';
    var ASCIIDOCTOR_DEFAULT_ATTRIBUTES = ['showtitle=@', 'icons=font', 'sectanchors=@', 'source-highlighter=highlightjs@', 'platform=opal', 'platform-opal', 'env=docgist', 'env-docgist', 'toc=macro'];
    var DOCGIST_LIB_VERSIONS = {
        'highlightjs': '8.9.1',
        'prettify': 'r298',
        'codemirror': '5.8.0',
        'mathjax': '2.5.3'
    };
    window.DocgistLibVersions = DOCGIST_LIB_VERSIONS;

    var $content = undefined;
    var $gistId = undefined;

    $(document).ready(function () {
        $content = $('#content');
        $gistId = $('#gist-id');

        var gist = new Gist($, $content);
        gist.getGistAndRenderPage(renderContent, DEFAULT_SOURCE);
        $gistId.keydown(gist.readSourceId);
    });

    function getAsciidoctorOptions() {
        return Opal.hash({
            'to_file': false,
            'safe': 'secure',
            'attributes': ASCIIDOCTOR_DEFAULT_ATTRIBUTES.concat([].slice.apply(arguments))
        });
    }

    function renderContent(content, link, imageBaseLocation, siteBaseLocation, imageContentReplacer) {
        $('#gist-link').attr('href', link);
        $content.empty();
        var doc, html = undefined;
        var highlighter = undefined;
        try {
            doc = Opal.Asciidoctor.$load(content, getAsciidoctorOptions('parse_header_only=true'));
            var attributes = doc.attributes.map;
            var attributeOverrides = [];
            if ('source-highlighter' in attributes) {
                highlighter = attributes['source-highlighter'];
            }
            if (imageBaseLocation || siteBaseLocation) {
                if ('imagesdir' in attributes) {
                    // only alter relative values, not URLs
                    var imagesdir = attributes.imagesdir;
                    if (imagesdir.slice(-1) === '/') {
                        // root-relative URL
                        if (siteBaseLocation) {
                            attributeOverrides.push('imagesdir=' + siteBaseLocation + imagesdir);
                        }
                    } else if (imageBaseLocation && imagesdir.substr(0, 4) !== 'http') {
                        // relative URL
                        attributeOverrides.push('imagesdir=' + imageBaseLocation + '/' + imagesdir);
                    }
                } else if (imageBaseLocation) {
                    // default to the same location as the document
                    attributeOverrides.push('imagesdir=' + imageBaseLocation);
                }
            }
            html = Opal.Asciidoctor.$convert(content, getAsciidoctorOptions.apply(null, attributeOverrides));
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>');
            return;
        }
        $content.html(html);
        $gistId.val('');

        if ('tabbed-source' in attributes) {
            tabTheSource($content);
        }

        if (imageContentReplacer) {
            imageContentReplacer($content);
        }

        if (highlighter) {
            applyHighlighting(highlighter);
        }

        appendMathJax();
        setPageTitle(doc);

        // fix root-relative locations
        if (siteBaseLocation) {
            $('img[src ^= "/"]', $content).each(function () {
                this.src = siteBaseLocation + this.getAttribute('src');
            });
            $('a[href ^= "/"]', $content).each(function () {
                this.href = siteBaseLocation + this.getAttribute('href');
            });
        }

        share();
    }

    function tabTheSource($content) {
        var snippets = {};
        var order = {};
        var languageEventElements = {};
        $('div.listingblock', $content).each(function () {
            var $block = $(this);
            var title = $('div.title', this).text();
            if (!title) {
                return;
            }
            var $content = $('div.content', this);
            var language = $('code', $content).data('lang');
            if (title in order) {
                order[title].push(language);
            } else {
                order[title] = [language];
            }
            if (!(title in snippets)) {
                snippets[title] = {};
            }
            snippets[title][language] = {
                '$block': $block,
                '$content': $content
            };
        });
        var $UL = $('<ul class="nav nav-tabs" role="tablist"/>');
        var $LI = $('<li role="presentation"/>');
        var $A = $('<a role="tab" data-toggle="tab" style="text-decoration:none;"/>');
        var $WRAPPER = $('<div class="tab-content"/>');
        for (var title in order) {
            var languages = order[title];
            if (languages.length === 1) {
                continue;
            }
            var idBase = title.toLocaleLowerCase().replace(' ', '-');
            var $ul = $UL.clone();
            var $wrapper = $WRAPPER.clone();
            for (var i = 0; i < languages.length; i++) {
                var language = languages[i];
                var source = snippets[title][language];
                var $content = source['$content'];
                var id;
                if ($content.attr('id')) {
                    id = $content.attr('id');
                } else {
                    id = idBase + '-' + language;
                    $content.attr('id', id);
                }
                $content.addClass('tab-pane').css('position', 'relative');
                var $li = $LI.clone();
                var $a = $A.clone();
                $a.attr('href', '#' + id).text(language).data('lang', language).on('shown.bs.tab', function (e) {
                    var language = $(e.target).data('lang');
                    var $elements = languageEventElements[language];
                    for (var j = 0; j < $elements.length; j++) {
                        $elements[j].tab('show');
                    }
                });
                if (language in languageEventElements) {
                    languageEventElements[language].push($a);
                } else {
                    languageEventElements[language] = [$a];
                }
                $wrapper.append($content);
                if (i === 0) {
                    $li.addClass('active');
                    $content.addClass('active');
                } else {
                    source['$block'].remove();
                }
                $li.append($a);
                $ul.append($li);
            }
            snippets[title][languages[0]]['$block'].append($ul).append($wrapper);
        }
    }

    function setPageTitle(doc) {
        document.title = doc.$doctitle(Opal.hash({'sanitize': true, 'use_fallback': true}))
    }

    function share() {
        var title = document.title;
        var href = encodeURIComponent(window.location.href);
        $('#twitter-share').attr('href',
            'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check this out: ' + title) + '&url=' + href);
        $('#facebook-share').attr('href', 'http://www.facebook.com/share.php?u=' + href);
        $('#google-plus-share').attr('href', 'https://plus.google.com/share?url=' + href);
    }

    function appendMathJax() {
        var mathJaxJsScriptConfig = document.createElement('script');
        mathJaxJsScriptConfig.type = 'text/x-mathjax-config';
        mathJaxJsScriptConfig.text =
            'MathJax.Hub.Config({' +
            '  tex2jax: {' +
            '    inlineMath: [["\\\\(", "\\\\)"]],' +
            '    displayMath: [["\\\\[", "\\\\]"]],' +
            '    ignoreClass: "nostem|nostem|nolatexmath"' +
            '  },' +
            '  asciimath2jax: {' +
            '    delimiters: [["\\\\$", "\\\\$"]],' +
            '    ignoreClass: "nostem|nostem|noasciimath"' +
            '  }' +
            '});';
        document.head.appendChild(mathJaxJsScriptConfig);

        var version = DOCGIST_LIB_VERSIONS.mathjax;
        addScriptElement('https://cdnjs.cloudflare.com/ajax/libs/mathjax/' + version + '/MathJax.js?config=TeX-MML-AM_HTMLorMML');
    }

    function applyHighlighting(highlighter) {
        var hl = highlighter.toLowerCase();
        var AVAILABLE_HIGHLIGHTERS = {
            'highlightjs': highlightUsingHighlightjs,
            'highlight.js': highlightUsingHighlightjs,
            'prettify': highlightUsingPrettify,
            'codemirror': highlightUsingCodeMirror
        };
        if (hl in AVAILABLE_HIGHLIGHTERS) {
            AVAILABLE_HIGHLIGHTERS[hl]();
        } else {
            console.log('Unknown syntax highlighter: ' + highlighter);
            // not in IE8
            if ('keys' in Object) {
                console.log('Recognized highlighter names: ' + Object.keys(AVAILABLE_HIGHLIGHTERS));
            }
        }
    }

    function addScriptElement(url) {
        var element = document.createElement('script');
        element.type = 'text/javascript';
        element.async = true;
        element.src = url;
        var first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(element, first);
    }

    function executeScripts(urls) {
        // adds script elements and makes sure they execute in the order they are given
        // from http://www.html5rocks.com/en/tutorials/speed/script-loading/
        !function(e,t,r){function n(){for(;d[0]&&"loaded"==d[0][f];)c=d.shift(),c[o]=!i.parentNode.insertBefore(c,i)}for(var s,a,c,d=[],i=e.scripts[0],o="onreadystatechange",f="readyState";s=r.shift();)a=e.createElement(t),"async"in i?(a.async=!1,e.head.appendChild(a)):i[f]?(d.push(a),a[o]=n):e.write("<"+t+' src="'+s+'" defer></'+t+">"),a.src=s}(document,"script",urls)
    }

    function addLinkElement(url) {
        var element = document.createElement('link');
        element.rel = 'stylesheet';
        element.href = url;
        var first = document.getElementsByTagName('link')[0];
        first.parentNode.insertBefore(element, first);
    }

    function highlightUsingPrettify() {
        $('code[class^="language-"],code[class^="src-"]', $content).each(function (i, e) {
            e.className = e.className.replace('src-', 'language-') + ' prettyprint';
        });
        var version = DOCGIST_LIB_VERSIONS.prettify;
        addScriptElement('//cdnjs.cloudflare.com/ajax/libs/prettify/' + version + '/run_prettify.min.js');
    }

    function highlightUsingCodeMirror() {
        var version = DOCGIST_LIB_VERSIONS.codemirror;
        addLinkElement('//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/codemirror.min.css');
        addLinkElement('//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/theme/neo.min.css');
        executeScripts([
            '//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/codemirror.min.js',
            '//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/addon/runmode/runmode.min.js',
            '//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/addon/mode/loadmode.min.js',
            '//cdnjs.cloudflare.com/ajax/libs/codemirror/' + version + '/mode/meta.min.js',
            'js/colorize.js']);
    }

    function highlightUsingHighlightjs() {
        var version = DOCGIST_LIB_VERSIONS.highlightjs;
        addLinkElement('//cdnjs.cloudflare.com/ajax/libs/highlight.js/' + version + '/styles/github.min.css');
        executeScripts(['//cdnjs.cloudflare.com/ajax/libs/highlight.js/' + version + '/highlight.min.js', 'js/run-highlight.js']);
    }

    function errorMessage(message, gist) {
        var messageText;
        if (gist) {
            messageText = 'Somethng went wrong fetching "' + gist + '":<p>' + message + '</p>';
        }
        else {
            messageText = '<p>' + message + '</p>';
        }

        $content.html('<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>');
    }
}

DocGist(jQuery);
