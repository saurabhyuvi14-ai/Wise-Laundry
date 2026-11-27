// Usage: npm run make-staff -- someone@example.com        (make staff)
//        npm run make-staff -- someone@example.com RIDER|ADMIN|CUSTOMER
import mongoose from 'mongoose'
import { config } from '../src/config/env.js'
import { User } from '../src/models/User.js'

const [email, role = 'STAFF'] = process.argv.slice(2)
if (!email || !['STAFF', 'ADMIN', 'RIDER', 'CUSTOMER'].includes(role)) {
  console.log('Usage: npm run make-staff -- someone@example.com [STAFF|ADMIN|RIDER|CUSTOMER]')
  process.exit(1)
}

await mongoose.connect(config.MONGODB_URI)
const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { $set: { role } }, { new: true })
console.log(user ? `${user.email} is now ${user.role}. They need to log out and in again.` : `No account with email ${email}. They need to sign up first.`)
await mongoose.disconnect()
