'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = 'github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc';
    var ASCIIDOCTOR_OPTIONS = Opal.hash2(['to_file', 'safe', 'attributes'], {
        'to_file': false,
        'safe': 'secure',
        'attributes': ['showtitle=@', 'icons=font', 'sectanchors=@', 'source-highlighter=highlightjs@']
    });

    var $content = undefined;
    var $gistId = undefined;

    $(document).ready(function () {
        $content = $('#content');
        $gistId = $('#gist-id');

        var gist = new Gist($, $content);
        gist.getGistAndRenderPage(renderContent, DEFAULT_SOURCE);
        $gistId.keydown(gist.readSourceId);
    });

    function renderContent(content, link) {
        $('#gist-link').attr('href', link);
        $content.empty();
        var doc, html = undefined;
        var highlightSource = false;
        try {
            doc = Opal.Asciidoctor.$load(content, ASCIIDOCTOR_OPTIONS);
            var attributeEq = doc.$method('attr?');
            if (attributeEq.$call('source-highlighter', 'highlightjs') || attributeEq.$call('source-highlighter', 'highlight.js')) {
              highlightSource = true;
            }
            html = doc.$convert();
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>');
            return;
        }
        $content.html(html);
        $gistId.val('');
        if (highlightSource) {
          $('pre.highlight > code').each(function (i, e) {
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

        appendMathJax();
        setPageTitle(doc);
        share();
    }

    function setPageTitle(doc) {
        document.title = doc.$doctitle(Opal.hash2(['sanitize', 'use_fallback'], {'sanitize': true, 'use_fallback': true}))
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
        mathJaxJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.4.0/MathJax.js?config=TeX-MML-AM_HTMLorMML';
        document.head.appendChild(mathJaxJsScript);
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
