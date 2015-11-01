// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
// Modified by the DocGist team.

"use strict";

CodeMirror.colorize = function(collection, defaultMode) {
    var isBlock = /^(p|li|div|h\\d|pre|blockquote|td)$/;

    function textContent(node, out) {
        if (node.nodeType == 3) return out.push(node.nodeValue);
        for (var ch = node.firstChild; ch; ch = ch.nextSibling) {
            textContent(ch, out);
            if (isBlock.test(node.nodeType)) out.push("\n");
        }
    }

    function run(node, mode) {
        var found = false;
        for (var i = 0; i < CodeMirror.modeInfo.length; i++) {
            if (CodeMirror.modeInfo[i].mode === mode) {
                found = true;
                break;
            }
        }
        if (!found) {
            // avoid loading modes that don't exist
            return;
        }
        CodeMirror.requireMode(mode, function() {
            var text = [];
            textContent(node, text);
            node.innerHTML = "";
            CodeMirror.runMode(text.join(""), mode, node);

            node.className += mode == "cypher" ? " cm-s-neo" : " cm-s-default";
        });
    }

    if (!collection) collection = document.body.getElementsByTagName("code");

    for (var i = 0; i < collection.length; ++i) {
        var node = collection[i];
        var mode = node.getAttribute("data-lang");
        if (!mode) {
            var cls = node.className;
            if (cls && cls.indexOf("language-") === 0) {
                mode = cls.substr(9);
            } else if (cls && cls.indexOf("src-") === 0) {
                mode = cls.substr(4);
            } else {
                mode = defaultMode;
            }
        }
        if (!mode) continue;

        var info = CodeMirror.findModeByName(mode);
        if (info) {
            mode = info.mode;
        } else {
            info = CodeMirror.findModeByMIME(mode);
            if (info) {
                mode = info.mode;
            }
        }

        run(node, mode);
    }
};
