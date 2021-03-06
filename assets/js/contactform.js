$(function(){
    $('#contact-form').submit(function(e){

        // Stop the form actually posting
        e.preventDefault();

        grecaptcha.ready(function () {
            grecaptcha.execute('6Lcf9fcUAAAAACKHtt-sjuyyzPxMJUaA4SS8ndG7', {action: 'contactform'}).then(function (recaptchaToken) {
                // add recaptcha token to hidden value
                $('#contact-form-recaptcha-token').val(recaptchaToken);

                // reset alert box
                $('#contact-form-alert').hide();
                $('#contact-form-alert').empty();
                $('#contact-form-alert').removeClass('alert-green');
                $('#contact-form-alert').removeClass('alert-red');

                // block button to time when post ajax request is sending
                $('#contact-form-btn').removeClass('btn-enable-on-input');
                $('#contact-form-btn').addClass('btn-disable-on-input');
                $('#contact-form-btn').attr('disabled', true);
                $('#contact-form-btn').html('<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...')

                // send post request
                $.post('https://masiarekpl-contactform-backend.herokuapp.com', {
                    'name': $('#contact-form-nameInput').val(),
                    'email': $('#contact-form-replyToInput').val(),
                    'subject': $('#contact-form-subjectInput').val(),
                    'message': $('#contact-form-messageInput').val(),
                    'g-recaptcha-response': recaptchaToken
                }, function(response){
                    var obj = JSON.parse(JSON.stringify(response))
                    if(obj.status=="success") {
                        $('#contact-form-alert').addClass('alert-green');
                    } else {
                        $('#contact-form-alert').addClass('alert-red');
                    }
                    // show alert
                    $('#contact-form-alert').append(obj.result);
                    $('#contact-form-alert').show();

                    // reset blocked button
                    $('#contact-form-btn').removeClass('btn-disable-on-input');
                    $('#contact-form-btn').addClass('btn-enable-on-input');
                    $('#contact-form-btn').removeAttr('disabled');
                    $('#contact-form-btn').html('<i class="fas fa-paper-plane"></i> &nbsp; Send Email.')
                    $('#contact-form').trigger('reset');
                });
            });
        });
    });
});
