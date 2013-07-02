'use strict';

var ASCIIDOCTOR_OPTIONS = Opal.hash2( [ 'attributes' ], {
  'attributes' : [ 'notitle!' ]
} );
var DEFAULT_GIST = '5897167';
var $IMG = $( '<img>' );
var VALID_GIST = /^[0-9a-f]{5,32}$/;

var $content = undefined;
var $gistId = undefined;

$( document ).ready( function()
{
  $content = $( '#content' );
  $gistId = $( '#gist-id' );

  renderPage();

  $gistId.keydown( function( event )
  {
    var $target = $( event.target );
    if ( event.which === 13 || event.which === 9 )
    {
      event.preventDefault();
      $target.blur();
      var gist = $.trim( $target.val() );
      if ( gist.indexOf( '/' ) !== -1 )
      {
        var pos = gist.lastIndexOf( '/' );
        gist = gist.substr( pos + 1 );
      }
      if ( gist.charAt( 0 ) === '?' )
      {
        // for the case a DocGist URL was pasted by mistake!
        gist = gist.substr( 1 );
      }
      if ( VALID_GIST.test( gist ) )
      {
        window.location.assign( '?' + gist );
      }
      else
      {
        errorMessage( 'The gist id is malformed.', gist );
      }
    }
  } );
} );

function renderPage()
{
  var gist = window.location.search;
  if ( gist.length < 2 )
  {
    gist = DEFAULT_GIST;
  }
  else
  {
    gist = gist.substr( 1 );
  }
  var url = 'https://api.github.com/gists/' + gist;
  $.ajax( {
    'url' : url,
    'success' : function( data )
    {
      var file = data.files[Object.keys( data.files )[0]];
      var doc = file.content;
      $( '#gist-link' ).attr( 'href', data.html_url );
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
      // transform image links to images
      $( 'a[href]', $content ).each( function()
      {
        var $link = $( this );
        if ( $link.text() === this.href && this.href.length > 4 )
        {
          var ext = this.href.split( '.' ).pop();
          if ( 'png|jpg|jpeg|svg'.indexOf( ext ) !== -1 )
          {
            $link.replaceWith( $IMG.clone().attr( 'src', this.href ) );
          }
        }
      } );
      $gistId.val( '' );
    },
    'dataType' : 'json',
    'error' : function( xhr, status, error )
    {
      errorMessage( error.gist );
    }
  } );
}

function errorMessage( message, gist )
{
  var messageText;
  if ( gist )
  {
    messageText = 'Somethng went wrong fetching the gist "' + gist + '":<p>' + message + '</p>';
  }
  else
  {
    messageText = '<p>' + message + '</p>';
  }

  $content.html( '<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>' );
}
