'use strict';

function DocGist( $ )
{
  var ASCIIDOCTOR_OPTIONS = Opal.hash2( [ 'attributes' ], {
    'attributes' : [ 'notitle!' ]
  } );
  var VALID_GIST = /^[0-9a-f]{5,32}$/;
  var DROPBOX_BASE_URL = 'https://dl.dropboxusercontent.com/u/';
  var DEFAULT_SOURCE = '5897167';

  var LOCAL_DOCUMENT_SOURCE_ROOT = 'https://github.com/nawroth/docgist/tree/master/gists/';
  var LOCAL_DOCUMENT_EXTENSION = '.adoc';

  var $content = undefined;
  var $gistId = undefined;

  $( document ).ready( function()
  {
    $content = $( '#content' );
    $gistId = $( '#gist-id' );

    renderPage();
    share();
    $gistId.keydown( readSourceId );
  } );

  function renderPage()
  {
    var id = window.location.search;
    if ( id.length < 2 )
    {
      id = DEFAULT_SOURCE;
    }
    else
    {
      id = id.substr( 1 );
    }
    var fetcher = fetchGithubGist;
    if ( id.length > 8 && id.substr( 0, 8 ) === 'dropbox-' )
    {
      fetcher = fetchDropboxFile;
      id = id.substr( 8 );
    }
    else if ( !VALID_GIST.test( id ) )
    {
      if ( id.indexOf( '%3A%2F%2F' ) !== -1 )
      {
        fetcher = fetchAnyUrl;
      }
      else
      {
        fetcher = fetchLocalSnippet;
      }
    }
    fetcher( id, renderContent, function( message )
    {
      errorMessage( message, id );
    } );
  }

  function renderContent( doc, link )
  {
    $( '#gist-link' ).attr( 'href', link );
    $content.empty();
    var generatedHtml = undefined;
    try
    {
      generatedHtml = Opal.Asciidoctor.$render( doc, ASCIIDOCTOR_OPTIONS );
    }
    catch ( e )
    {
      errorMessage( e.name + ':' + '<p>' + e.message + '</p>' );
      return;
    }
    $content.html( generatedHtml );
    $gistId.val( '' );
    $( 'pre > code' ).each( function( i, e )
    {
      hljs.highlightBlock( e );
    } );
  }

  function fetchGithubGist( gist, success, error )
  {
    if ( !VALID_GIST.test( gist ) )
    {
      error( 'The gist id is malformed: ' + gist );
      return;
    }

    var url = 'https://api.github.com/gists/' + gist;
    $.ajax( {
      'url' : url,
      'success' : function( data )
      {
        var file = data.files[Object.keys( data.files )[0]];
        var content = file.content;
        var link = data.html_url;
        success( content, link );
      },
      'dataType' : 'json',
      'error' : function( xhr, status, errorMessage )
      {
        error( errorMessage );
      }
    } );
  }

  function fetchDropboxFile( id, success, error )
  {
    var url = DROPBOX_BASE_URL + decodeURIComponent( id );
    $.ajax( {
      'url' : url,
      'success' : function( data )
      {
        success( data, url );
      },
      'dataType' : 'text',
      'error' : function( xhr, status, errorMessage )
      {
        error( errorMessage );
      }
    } );
  }

  function fetchAnyUrl( id, success, error )
  {
    var url = decodeURIComponent( id );
    $.ajax( {
      'url' : url,
      'success' : function( data )
      {
        success( data, url );
      },
      'dataType' : 'text',
      'error' : function( xhr, status, errorMessage )
      {
        error( errorMessage );
      }
    } );
  }

  function fetchLocalSnippet( id, success, error )
  {
    var url = './gists/' + id + '.adoc';
    $.ajax( {
      'url' : url,
      'success' : function( data )
      {
        var link = LOCAL_DOCUMENT_SOURCE_ROOT + id + LOCAL_DOCUMENT_EXTENSION;
        success( data, link );
      },
      'dataType' : 'text',
      'error' : function( xhr, status, errorMessage )
      {
        error( errorMessage );
      }
    } );
  }

  function readSourceId( event )
  {
    var $target = $( event.target );
    if ( event.which === 13 || event.which === 9 )
    {
      event.preventDefault();
      $target.blur();
      var gist = $.trim( $target.val() );
      if ( gist.indexOf( '/' ) !== -1 )
      {
        var baseLen = DROPBOX_BASE_URL.length;
        if ( gist.length > baseLen && gist.substr( 0, baseLen ) === DROPBOX_BASE_URL )
        {
          gist = 'dropbox-' + encodeURIComponent( gist.substr( baseLen ) );
        }
        else
        {
          var pos = gist.lastIndexOf( '/' );
          var endOfUrl = gist.substr( pos + 1 );
          if ( gist.indexOf( '://' ) !== -1 && !VALID_GIST.test( endOfUrl ) )
          {
            gist = encodeURIComponent( gist );
          }
          else
          {
            gist = endOfUrl;
          }
        }
      }
      if ( gist.charAt( 0 ) === '?' )
      {
        // in case a DocGist URL was pasted by mistake!
        gist = gist.substr( 1 );
      }
      window.location.assign( '?' + gist );
    }
  }

  function share()
  {
    var title = document.title;
    var href = encodeURIComponent( window.location.href );
    $( '#twitter-share' ).attr( 'href',
        'https://twitter.com/intent/tweet?text=' + encodeURIComponent( 'Check this out: ' + title ) + '&url=' + href );
    $( '#facebook-share' ).attr( 'href', 'http://www.facebook.com/share.php?u=' + href );
  }

  function errorMessage( message, gist )
  {
    var messageText;
    if ( gist )
    {
      messageText = 'Somethng went wrong fetching "' + gist + '":<p>' + message + '</p>';
    }
    else
    {
      messageText = '<p>' + message + '</p>';
    }

    $content.html( '<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>' );
  }
}

DocGist( jQuery );
