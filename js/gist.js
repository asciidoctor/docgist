/**
 * Licensed to Neo Technology under one or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership. Neo Technology licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

'use strict';

function Gist($, $content) {

    var DROPBOX_PUBLIC_BASE_URL = 'https://dl.dropboxusercontent.com/u/';
    var DROPBOX_PRIVATE_BASE_URL = 'https://www.dropbox.com/s/';
    var DROPBOX_PRIVATE_API_BASE_URL = 'https://dl.dropboxusercontent.com/s/';
    var RISEUP_BASE_URL = 'https://pad.riseup.net/p/';
    var RISEUP_EXPORT_POSTFIX = '/export/txt';
    var COPY_COM_PUBLIC_LINK = 'https://copy.com/';

    var VALID_GIST = /^[0-9a-f]{5,32}\/?$/;

    var internal = {};
    internal['sourceParsers'] = {
        'GitHub Gist': {
            'baseUrl': 'https://gist.github.com/', 'parse': function (gist, parts) {
                return useGithubGist(4, parts.length - 1, parts);
            }
        },
        'Raw GitHub Gist': {
            'baseUrl': 'https://gist.githubusercontent.com/', 'parse': function (gist, parts) {
                return useGithubGist(5, 4, parts);
            }
        },
        'GitHub Repository File': {
            'baseUrl': 'https://github.com/', 'parse': function (gist, parts) {
                return useGithubRepoParts({'branch': 6, 'path': 7}, parts);
            }
        },
        'Raw GitHub Repository File': {
            'baseUrl': ['https://raw.github.com/', 'https://raw.githubusercontent.com/'], 'parse': function (gist, parts) {
                return useGithubRepoParts({'branch': 5, 'path': 6}, parts);
            }
        },
        'Public Dropbox File': {
            'baseUrl': DROPBOX_PUBLIC_BASE_URL, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('dropbox-', baseUrl, gist);
            }
        },
        'Shared Private Dropbox File': {
            'baseUrl': DROPBOX_PRIVATE_BASE_URL, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('dropboxs-', baseUrl, gist);
            }
        },
        'Copy.com Public Link': {
            'baseUrl': COPY_COM_PUBLIC_LINK, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('copy-', baseUrl, gist);
            }
        },
        'Riseup Pad': {
            'baseUrl': RISEUP_BASE_URL, 'parse': function (gist, parts) {
                if (parts.length < 5) {
                    return {'error': 'No pad id in the URL.'};
                }
                var pad = parts[4];
                if (pad.length < 1) {
                    return {'error': 'Missing pad id in the URL.'};
                }
                return {'id': 'riseup-' + pad};
            }
        },
        'Etherpad': {
            'baseUrl': ['https://beta.etherpad.org/', 'https://piratepad.ca/p/', 'https://factor.cc/pad/p/', 'https://pad.systemli.org/p/', 'https://pad.fnordig.de/p/',
                'https://notes.typo3.org/p/', 'https://pad.lqdn.fr/p/', 'https://pad.okfn.org/p/', 'https://beta.publishwith.me/p/', 'https://tihlde.org/etherpad/p/',
                'https://tihlde.org/pad/p/', 'https://etherpad.wikimedia.org/p/', 'https://etherpad.fr/p/', 'https://piratenpad.de/p/', 'https://bitpad.co.nz/p/',
                'http://notas.dados.gov.br/p/', 'http://free.primarypad.com/p/', 'http://board.net/p/', 'https://pad.odoo.com/p/', 'http://pad.planka.nu/p/',
                'http://qikpad.co.uk/p/', 'http://pad.tn/p/', 'http://lite4.framapad.org/p/', 'http://pad.hdc.pw/p/'],
            'parse': function (gist, parts, baseUrl) {
                if (gist.length <= baseUrl.length) {
                    return {'error': 'No pad id in the URL.'};
                }
                var baseParts = baseUrl.split('/');
                var pad = parts[baseParts.length - 1];
                if (pad.length < 1) {
                    return {'error': 'Missing pad id in the URL.'};
                }
                var basePrefix = baseUrl.indexOf('https') === 0 ? 'eps' : 'ep';
                var prefix = '';
                if (baseUrl.indexOf('/p/') !== -1) {
                    prefix = 'p';
                } // intentionally no else
                if (baseUrl.indexOf('/pad/p/') !== -1) {
                    prefix = 'pp';
                } else if (baseUrl.indexOf('/etherpad/p/') !== -1) {
                    prefix = 'ep';
                }
                prefix = basePrefix + prefix + '-';
                return {'id': prefix + baseParts[2] + '-' + pad};
            }
        }
    };
    internal['fetchers'] = {
        'github-': fetchGithubFile,
        'dropbox-': fetchPublicDropboxFile,
        'dropboxs-': fetchPrivateDropboxFile,
        'copy-': fetchCopyComPublicLink,
        'riseup-': fetchRiseupFile,
        'eps-': fetchSecureEtherpadFile,
        'epsp-': fetchSecureEtherpadPDirFile,
        'epspp-': fetchSecureEtherpadPadPDirFile,
        'epsep-': fetchSecureEtherpadPadEtherpadDirFile,
        'epp-': fetchEtherpadPDirFile
    };

    return {'getGistAndRenderPage': getGistAndRenderPage, 'readSourceId': readSourceId};

    function getGistAndRenderPage(renderer, defaultSource) {
        var id = window.location.search;
        if (id.length < 2) {
            id = defaultSource;
        }
        else {
            id = id.substr(1);
            var idCut = id.indexOf('&');
            if (idCut !== -1) {
                id = id.substring(0, idCut);
            }
            if (id.indexOf('_ga=') === 0) {
                id = defaultSource;
            }
        }
        var fetcher = null;
        for (var fetch in internal.fetchers) {
            if (id.indexOf(fetch) === 0) {
                fetcher = internal.fetchers[fetch];
                break;
            }
        }
        if (!fetcher) {
            if (!VALID_GIST.test(id) && id.indexOf('%3A%2F%2F') !== -1) {
                fetcher = fetchAnyUrl;
            } else {
                fetcher = fetchGithubGist;
            }
        }
        fetcher(id, renderer, function (message) {
            errorMessage(message, id);
        });
    }

    function readSourceId(event) {
        if (event.which !== 13 && event.which !== 9) {
            return;
        }
        event.preventDefault();
        var $target = $(event.target);
        $target.blur();
        var gist = $.trim($target.val());
        if (gist.indexOf('/') !== -1) {
            var parts = gist.split('/');
            for (var sourceParserName in internal.sourceParsers) {
                var sourceParser = internal.sourceParsers[sourceParserName];
                var baseUrls = sourceParser.baseUrl;
                if (!Array.isArray(baseUrls)) {
                    baseUrls = [baseUrls];
                }
                for (var j = 0; j < baseUrls.length; j++) {
                    var baseUrl = baseUrls[j];
                    if (gist.indexOf(baseUrl) === 0) {
                        var result = sourceParser.parse(gist, parts, baseUrl);
                        if ('error' in result && result.error) {
                            errorMessage('Error when parsing "' + gist + '" as a ' + sourceParserName + '.\n' + result.error);
                        } else if ('id' in result) {
                            window.location.assign('?' + result.id);
                        }
                        return;
                    }
                }
            }
            if (gist.indexOf('?') !== -1) {
                // in case a DocGist URL was pasted
                gist = gist.split('?').pop();
            } else {
                if (gist.indexOf('://') !== -1) {
                    gist = encodeURIComponent(gist);
                }
                else {
                    errorMessage('Do not know how to parse "' + gist + '" as a DocGist source URL.');
                }
            }
        }
        window.location.assign('?' + gist);
    }

    function useGithubGist(minLength, index, parts) {
        if (parts.length < minLength) {
            return {'error': 'No gist id in the URL.'};
        }
        var id = parts[index];
        if (!VALID_GIST.test(id)) {
            return {'error': 'No valid gist id in the url.'};
        }
        return {'id': id};
    }

    function useGithubRepoParts(indexes, parts) {
        var pathIndex = indexes['path'];
        var branchIndex = indexes['branch'];
        var organizationIndex = 3;
        var repoIndex = 4;
        if (parts.length >= pathIndex) {
            var id = 'github-' + parts[organizationIndex] + '/' + parts[repoIndex];
            if (parts[branchIndex] !== 'master') {
                id += '/' + parts[branchIndex];
            }
            id += '//' + parts.slice(pathIndex).join('/');
            id = encodeURIComponent(id);
            return {'id': id};
        } else {
            return {'error': 'Missing content in the URL.'};
        }
    }

    function useRestOfTheUrl(prefix, baseUrl, gist) {
        if (gist.length <= baseUrl.length) {
            return {'error': 'Missing content in the URL.'};
        }
        return {'id': prefix + encodeURIComponent(gist.substr(baseUrl.length))};
    }


    function fetchGithubGist(gist, success, error) {
        if (!VALID_GIST.test(gist)) {
            error('The gist id is malformed: ' + gist);
            return;
        }

        var url = 'https://api.github.com/gists/' + gist.replace("/", "");
        $.ajax({
            'url': url,
            'success': function (data) {
                var file = data.files[Object.keys(data.files)[0]];
                var content = file.content;
                var link = data.html_url;
                success(content, link);
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function fetchGithubFile(gist, success, error) {
        gist = gist.substr(7);
        var decoded = decodeURIComponent(gist);
        var parts = decoded.split('/');
        var branch = 'master';
        var pathPartsIndex = 3;
        if (decoded.indexOf('/contents/') !== -1) {
            window.location.assign('?github-' + encodeURIComponent(decoded.replace('/contents/', '//')));
            return;
        }
        if (parts.length >= 4 && parts[3] === '') {
            branch = parts[2];
            pathPartsIndex++;
        }
        var url = 'https://api.github.com/repos/' + parts[0] + '/' + parts[1] + '/contents/' + parts.slice(pathPartsIndex).join('/');
        $.ajax({
            'url': url,
            'data': {'ref': branch},
            'success': function (data) {
                var content = Base64.decode(data.content);
                var link = data.html_url;
                var imagesdir = 'https://raw.github.com/' + parts[0] + '/' + parts[1]
                    + '/' + branch + '/' + data.path.substring(0, -data.name.length);
                success(content, link, imagesdir);
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function fetchPublicDropboxFile(id, success, error) {
        id = id.substr(8);
        fetchDropboxFile(id, success, error, DROPBOX_PUBLIC_BASE_URL);
    }

    function fetchPrivateDropboxFile(id, success, error) {
        id = id.substr(9);
        fetchDropboxFile(id, success, error, DROPBOX_PRIVATE_API_BASE_URL);
    }

    function fetchDropboxFile(id, success, error, baseUrl) {
        fetchFromUrl(baseUrl + decodeURIComponent(id), success, error);
    }

    function fetchCopyComPublicLink(id, success, error) {
        id = id.substr(5);
        fetchFromUrl(COPY_COM_PUBLIC_LINK + decodeURIComponent(id), success, error);
    }

    function fetchRiseupFile(id, success, error) {
        id = id.substr(7);
        var webUrl = RISEUP_BASE_URL + decodeURIComponent(id);
        fetchFromUrl(webUrl + RISEUP_EXPORT_POSTFIX, success, error, webUrl);
    }

    function fetchSecureEtherpadFile(id, success, error) {
        fetchEtherpad(id, success, error, true);
    }

    function fetchSecureEtherpadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'p');
    }

    function fetchSecureEtherpadPadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'pad/p');
    }

    function fetchSecureEtherpadPadEtherpadDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'etherpad/p');
    }

    function fetchEtherpadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, false, 'p');
    }

    function fetchEtherpad(id, success, error, secure, dir, exportPostfix) {
        var idParts = id.split('-');
        var host = idParts[1];
        var pad = idParts.slice(2).join('-');
        var webUrl = (secure ? 'https' : 'http') + '://' + host + '/' + (dir ? dir + '/' : '') + decodeURIComponent(pad);
        var exportUrl = webUrl + (exportPostfix ? exportPostfix : '/export/txt');
        fetchFromUrl(exportUrl, success, error, webUrl);
    }

    function fetchAnyUrl(id, success, error) {
        fetchFromUrl(decodeURIComponent(id), success, error);
    }

    function fetchFromUrl(url, success, error, sourceUrl) {
        $.ajax({
            'url': url,
            'success': function (data) {
                success(data, sourceUrl ? sourceUrl : url);
            },
            'dataType': 'text',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function errorMessage(message, gist) {
        var messageText;
        if (gist) {
            messageText = 'Something went wrong fetching the DocGist "' + gist + '":<p>' + message + '</p>';
        }
        else {
            messageText = '<p>' + message + '</p>';
        }

        $content.html('<div class="alert alert-danger"><h4>Error</h4>' + messageText + '</div>');
    }
}
