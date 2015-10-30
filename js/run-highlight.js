$('code[class^="language-"],code[class^="src-"]', $('#content')).each(function (i, e) {
    e.className = e.className.replace('src-', 'language-');
    hljs.highlightBlock(e);
    var $e = $(e);
    if ($e.parent('pre.highlight').length === 0) {
        $e.css('display', 'inline');
    }
});
