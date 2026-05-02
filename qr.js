require('qrcode').toFile('qr.png', 'https://dividing-lucrative-capacity.ngrok-free.dev', {width:400}, function(err){
  if(err) console.error(err);
  else console.log('QR saved!');
});
