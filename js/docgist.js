'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = 'github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc';
    var ASCIIDOCTOR_DEFAULT_ATTRIBUTES = ['showtitle=@', 'icons=font', 'sectanchors=@', 'source-highlighter=highlightjs@', 'platform=opal', 'platform-opal', 'env=browser', 'env-browser'];

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

    function renderContent(content, link, imageBasePath) {
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
            if (imageBasePath) {
                if ('imagesdir' in attributes) {
                    // only alter relative values, not URLs
                    if (attributes.imagesdir.substr(0, 4) !== 'http') {
                        attributeOverrides.push('imagesdir=' + imageBasePath + attributes.imagesdir);
                    }
                } else {
                    // default to the same location as the document
                    attributeOverrides.push('imagesdir=' + imageBasePath.substr(0, imageBasePath.length - 1));
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

        if (highlighter) {
            applyHighlighting(highlighter);
        }

        appendMathJax();
        setPageTitle(doc);
        share();
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

        var mathJaxJsScript = document.createElement('script');
        mathJaxJsScript.type = 'text/javascript';
        mathJaxJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.5.1/MathJax.js?config=TeX-MML-AM_HTMLorMML';
        document.head.appendChild(mathJaxJsScript);
    }

    function applyHighlighting(highlighter) {
        var hl = highlighter.toLowerCase();
        var AVAILABLE_HIGHLIGHTERS = {
            'highlightjs': highlightUsingHighlightjs,
            'highlight.js': highlightUsingHighlightjs,
            'prettify': highlightUsingPrettify
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

    function highlightUsingPrettify() {
        $('pre.highlight > code', $content).each(function (i, e) {
            // only highlight blocks marked with an explicit language
            if (e.hasAttribute('data-lang')) {
                $(e).addClass('prettyprint');
            }
        });
        var prettify = document.createElement('script');
        prettify.type = 'text/javascript';
        prettify.async = true;
        prettify.src = 'https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/run_prettify.min.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(prettify, s);
    }

    function highlightUsingHighlightjs() {
        $('pre.highlight > code', $content).each(function (i, e) {
            // only highlight blocks marked with an explicit language
            if (e.hasAttribute('data-lang')) {
                hljs.highlightBlock(e);
            }
            else {
                // NOTE add class to work around missing styles on code element
                $(e).addClass('hljs');
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
