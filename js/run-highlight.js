$('pre.highlight > code', $('#content')).each(function (i, e) {
    // only highlight blocks marked with an explicit language
    if (e.hasAttribute('data-lang')) {
        hljs.highlightBlock(e);
    }
    else {
        // NOTE add class to work around missing styles on code element
        $(e).addClass('hljs');
    }
});
