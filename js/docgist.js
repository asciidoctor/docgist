'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = 'github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc';
    var ASCIIDOCTOR_OPTIONS = Opal.hash2([ 'attributes' ], {
        'attributes': [ 'showtitle' ]
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

    function renderContent(doc, link) {
        $('#gist-link').attr('href', link);
        $content.empty();
        var generatedHtml = undefined;
        try {
            generatedHtml = Opal.Asciidoctor.$render(doc, ASCIIDOCTOR_OPTIONS);
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>');
            return;
        }
        $content.html(generatedHtml);
        $gistId.val('');
        $('pre > code').each(function (i, e) {
            hljs.highlightBlock(e);
        });

        setPageTitle();
        share();
    }

    function setPageTitle() {
        var heading = $('h1').first();
        if (!heading.length) {
            heading = $('h2').first();
        }
        if (heading.length) {
            document.title = heading.text();
        }
    }

    function share() {
        var title = document.title;
        var href = encodeURIComponent(window.location.href);
        $('#twitter-share').attr('href',
                'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check this out: ' + title) + '&url=' + href);
        $('#facebook-share').attr('href', 'http://www.facebook.com/share.php?u=' + href);
        $('#google-plus-share').attr('href', 'https://plus.google.com/share?url=' + href);
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
