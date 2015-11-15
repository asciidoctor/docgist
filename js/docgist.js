'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = decodeURIComponent('github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc');
    var DOCGIST_LIB_VERSIONS = {
        'prettify': 'r298',
        'mathjax': '2.5.3'
    };
    window.DocgistLibVersions = DOCGIST_LIB_VERSIONS;
    var DEFAULT_HIGHLIGHTER = 'codemirror';
    var UNAVAILABLE_HIGHLIGHTERS = ['coderay', 'pygments', 'source-highlight', 'highlight'];
    var ASCIIDOCTOR_DEFAULT_ATTRIBUTES = {
        'showtitle': '@',
        'icons': 'font',
        'sectanchors': '@',
        'source-highlighter': DEFAULT_HIGHLIGHTER + '@',
        'coderay-unavailable': '',
        'pygments-unavailable': '',
        'platform': 'opal',
        'platform-opal': '',
        'env': 'docgist',
        'env-docgist': '',
        'toc': 'macro',
        'example-caption!': '@'
    };

    var $content = undefined;
    var $gistId = undefined;
    var urlAttributes = undefined;

    $(document).ready(function () {
        $content = $('#content');
        $gistId = $('#gist-id');

        var gist = new Gist($, $content);
        var urlInfo = getUrlAttributes();
        urlAttributes = urlInfo.attributes;
        gist.getGistAndRenderPage(renderContent, urlInfo.id, DEFAULT_SOURCE);
        $gistId.keydown(gist.readSourceId);
    });

    function getAsciidoctorOptions(overrides, urlOverrides) {
        var attributes = $.extend({}, ASCIIDOCTOR_DEFAULT_ATTRIBUTES, urlOverrides, overrides);
        var attributeList = [];
        for (var key in attributes) {
            attributeList.push(key + '=' + attributes[key]);
        }
        return Opal.hash({
            'to_file': false,
            'safe': 'secure',
            'attributes': attributeList
        });
    }

    function getUrlAttributes() {
        // from http://stackoverflow.com/a/2880929/36710
        var attributes = {};
        var match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, " "));
            },
            query = window.location.search.substring(1);

        var first = undefined;
        while (match = search.exec(query)) {
            if (!first) {
                first = decode(match[1]);
            } else {
                attributes[decode(match[1])] = decode(match[2]);
            }
        }
        return {'id': first, 'attributes': attributes};
    }

    function existsInObjectOrHash(key, hash, object) {
        if (key in object) {
            return true;
        } else {
            return hash['$has_key?'](key);
        }
    }

    function getValueFromObjectOrHash(key, hash, object) {
        if (key in object) {
            return object[key];
        } else {
            return hash.$fetch(key);
        }
    }

    function renderContent(content, options) {
        if ('sourceUrl' in options) {
            $('#gist-link').attr('href', options['sourceUrl']);
        }
        $content.empty();
        var doc, html = undefined;
        var highlighter = undefined;
        var sourceLanguage = undefined;
        try {
            doc = Opal.Asciidoctor.$load(content, getAsciidoctorOptions({'parse_header_only': 'true'}));
            var attributes = doc.attributes;
            var attributeOverrides = {};

            if (existsInObjectOrHash('source-highlighter', attributes, urlAttributes)) {
                highlighter = getValueFromObjectOrHash('source-highlighter', attributes, urlAttributes).toLowerCase();
                if ($.inArray(highlighter, UNAVAILABLE_HIGHLIGHTERS) !== -1) {
                    console.log('Syntax highlighter not supported by DocGist: "' + highlighter + '", using "' + DEFAULT_HIGHLIGHTER + '" instead.');
                    attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
                    highlighter = DEFAULT_HIGHLIGHTER;
                }
            } else {
                attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
                highlighter = DEFAULT_HIGHLIGHTER;
            }

            if (existsInObjectOrHash('source-language', attributes, urlAttributes)) {
                sourceLanguage = getValueFromObjectOrHash('source-language', attributes, urlAttributes).toLowerCase();
            } else if (existsInObjectOrHash('language', attributes, urlAttributes)) {
                sourceLanguage = getValueFromObjectOrHash('language', attributes, urlAttributes).toLowerCase();
            }

            if ('imageBaseLocation' in options || 'siteBaseLocation' in options) {
                if (existsInObjectOrHash('imagesdir', attributes, urlAttributes)) {
                    // only alter relative values, not URLs
                    var imagesdir = getValueFromObjectOrHash('imagesdir', attributes, urlAttributes);
                    if (imagesdir.slice(-1) === '/') {
                        // root-relative URL
                        if ('siteBaseLocation' in options) {
                            attributeOverrides['imagesdir'] = options['siteBaseLocation'] + imagesdir;
                        }
                    } else if ('imageBaseLocation' in options && imagesdir.substr(0, 4) !== 'http') {
                        // relative URL
                        attributeOverrides['imagesdir'] = options['imageBaseLocation'] + '/' + imagesdir;
                    }
                } else if ('imageBaseLocation' in options) {
                    // default to the same location as the document
                    attributeOverrides['imagesdir'] = options['imageBaseLocation'];
                }
            }

            html = Opal.Asciidoctor.$convert(content, getAsciidoctorOptions(attributeOverrides, urlAttributes));
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>');
            return;
        }
        $content.html(html);
        $gistId.val('');

        tabTheSource($content);

        if ('imageContentReplacer' in options) {
            options['imageContentReplacer']($content);
        }

        if (highlighter) {
            applyHighlighting(highlighter, sourceLanguage);
        }

        appendMathJax();
        setPageTitle(doc);

        // fix root-relative locations
        if ('siteBaseLocation' in options) {
            $('img[src ^= "/"]', $content).each(function () {
                this.src = options['siteBaseLocation'] + this.getAttribute('src');
            });
            $('a[href ^= "/"]', $content).each(function () {
                this.href = options['siteBaseLocation'] + this.getAttribute('href');
            });
        }

        if ('interXrefReplacer' in options) {
            options['interXrefReplacer']($content);
        }

        share();
    }

    function tabTheSource($content) {
        var $UL = $('<ul class="nav nav-tabs" role="tablist"/>');
        var $LI = $('<li role="presentation"/>');
        var $A = $('<a role="tab" data-toggle="tab" style="text-decoration:none;"/>');
        var $WRAPPER = $('<div class="tab-content content"/>');
        var snippets = [];
        var languageEventElements = {};
        $('div.tabbed-example', $content).each(function () {
            var $exampleBlock = $(this);
            var title = $exampleBlock.children('div.title', this).first().text();
            var languages = [];
            var $languageBlocks = {};
            $('div.listingblock', this).each(function () {
                var language = $('code', this).data('lang');
                languages.push(language);
                $languageBlocks[language] = $(this);
            });
            if (languages.length > 1) {
                snippets.push({
                    '$exampleBlock': $exampleBlock,
                    'languages': languages,
                    '$languageBlocks': $languageBlocks
                });
            }
        });
        var idNum = 0;
        for (var ix = 0; ix < snippets.length; ix++) {
            var snippet = snippets[ix];
            var languages = snippet.languages;
            var $languageBlocks = snippet.$languageBlocks;
            var $exampleBlock = snippet.$exampleBlock;
            var idBase = 'tabbed-example-' + idNum++;
            var $wrapper = $WRAPPER.clone();
            var $ul = $UL.clone();
            for (var i = 0; i < languages.length; i++) {
                var language = languages[i];
                var $content = $($languageBlocks[language]);
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
                }
                $li.append($a);
                $ul.append($li);
            }
            $exampleBlock.children('div.content').first().replaceWith($ul);
            $exampleBlock.append($wrapper);
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

    function applyHighlighting(highlighter, sourceLanguage) {
        var AVAILABLE_HIGHLIGHTERS = {
            'highlightjs': highlightUsingHighlightjs,
            'highlight.js': highlightUsingHighlightjs,
            'prettify': highlightUsingPrettify,
            'codemirror': highlightUsingCodeMirror
        };

        if (sourceLanguage) {
            $('code.src', $content).each(function () {
                $(this).data('lang', sourceLanguage).addClass('src-' + sourceLanguage).removeClass('src');
            });
        }

        if (highlighter in AVAILABLE_HIGHLIGHTERS) {
            AVAILABLE_HIGHLIGHTERS[highlighter]();
        } else {
            console.log('Unknown syntax highlighter "' + highlighter + '", using "' + DEFAULT_HIGHLIGHTER + '" instead.');
            // not in IE8
            if ('keys' in Object) {
                console.log('Recognized highlighter names: ' + Object.keys(AVAILABLE_HIGHLIGHTERS));
            }
            AVAILABLE_HIGHLIGHTERS[DEFAULT_HIGHLIGHTER]();
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
        CodeMirror.colorize();
    }

    function highlightUsingHighlightjs() {
        $('code[class^="language-"],code[class^="src-"]', $content).each(function (i, e) {
            e.className = e.className.replace('src-', 'language-');
            hljs.highlightBlock(e);
            var $e = $(e);
            var $parent = $e.parent('pre.highlight');
            var language = $e.data('lang');
            if (!language) {
                var matches = e.className.match(/language-([a-z]*)/);
                if (matches.length === 2) {
                    language = matches[1];
                }
            }
            if ($parent.length === 0) {
                $e.css('display', 'inline').addClass(language).css('padding', 0);
            } else {
                $parent.addClass(language);
            }
        });
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
