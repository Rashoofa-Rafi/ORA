const nodemailer=require('nodemailer')
const env=require('dotenv').config

function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString()
}

async function sendVerificationEmail(email, OTP) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_USER,
                pass: process.env.NODEMAILER_PASS
            }
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_USER,
            to: email,
            subject: "Verify your ORA Account",
            text: `Your OTP is ${OTP}`



        })
        if (info.accepted.length > 0) {
            console.log(`OTP sent successfully to ${email}`);
            return true;
        } else {
            console.error(` Email not accepted by server`);
            return false;
        }
    } catch (error) {
        console.error('Error sending  OTP email', error)
        return false

    }
}


module.exports={
    generateOTP,
    sendVerificationEmail

}