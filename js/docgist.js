var ASCIIDOCTOR_OPTIONS = Opal.hash2( [ 'attributes' ], {
  'attributes' : [ 'notitle!' ]
} );
var DEFAULT_HASH = '#5897167';
var $IMG = $( '<img>' );

$( window ).hashchange( renderPage );

$( document ).ready( function()
{
  renderPage();
  $( '#gist-id' ).keydown( function( event )
  {
    var $target = $( event.target );
    if ( event.which === 13 || event.which === 9 )
    {
      event.preventDefault();
      $target.blur();
      window.history.pushState( {}, '', '#' + $.trim( $target.val() ) );
      renderPage();
    }
  } );
} );

function renderPage()
{
  if ( window.location.hash.length < 2 )
  {
    window.history.pushState( {}, "", DEFAULT_HASH );
  }
  var gist = window.location.hash.substr( 1 );
  // TODO: filter out anchor references from gist ids (which are hexadecimal)
  var url = 'https://api.github.com/gists/' + gist;
  $.ajax( {
    url : url,
    success : function( data )
    {
      var file = data.files[Object.keys( data.files )[0]];
      var doc = file.content;
      $( '#gist-link' ).attr( 'href', data.html_url );
      $content = $( '#content' );
      $content.empty();
      var generatedHtml = Opal.Asciidoctor.$render( doc, ASCIIDOCTOR_OPTIONS );
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
    },
    dataType : "json"
  } );
}
