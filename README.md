# 🎰 Raffle Winner Picker

A modern, transparent raffle application that makes conducting fair drawings simple and fun. Upload your participant list, watch the animated selection process, and share your results with confidence.

![Raffle Winner Picker](https://img.shields.io/badge/Status-Live-green) ![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ What It Does

Raffle Winner Picker takes the guesswork out of conducting fair raffles. Whether you're running a charity fundraiser, company giveaway, or community event, our platform ensures transparent, verifiable results that everyone can trust.

### 🎯 Key Features

- **📤 Easy Upload** - Drop your CSV file with participant names, emails, and ticket quantities
- **🎪 Live Animation** - Animated terminal-style visualization displays each participant during selection
- **📊 Smart Prizes** - Support multiple prizes with different winner counts per prize
- **🔒 Secure & Private** - Your data is protected with enterprise-grade authentication
- **📋 Instant Results** - Download winner lists and share public links to your raffle results
- **📱 Mobile Friendly** - Works perfectly on phones, tablets, and computers
- **🔄 Complete History** - Access all your past raffles anytime

## 🚀 Getting Started

### 1. Sign Up & Sign In
Visit [Raffle Winner Picker](https://rafflewinnerpicker.com) and sign in with your preferred account (Google, GitHub, or email).

### 2. Prepare Your Participant List
Create a CSV file with your participants. At minimum, include:
- **Name** - Participant's full name
- **Email** (optional) - For winner notifications
- **Tickets** (optional) - Number of entries per person
- **Prize** (optional) - Specific prizes participants are eligible for

**Example CSV:**
```csv
Name,Email,Tickets,Prize
John Doe,john@email.com,3,Grand Prize
Jane Smith,jane@email.com,1,Grand Prize
Bob Johnson,bob@email.com,2,Second Prize
```

### 3. Upload & Configure
1. **Upload your CSV** - Drag and drop or browse to select your file
2. **Map columns** - Tell us which columns contain names, emails, etc.
3. **Set up prizes** - Configure how many winners you want for each prize

### 4. Run Your Raffle
1. **Start the drawing** - Hit the big "Start Raffle" button
2. **Watch the excitement** - Enjoy the animated winner selection
3. **Celebrate winners** - See results in real-time as they're selected

### 5. Share Results
1. **Download winners** - Export results as CSV for your records
2. **Make it public** - Toggle public sharing to let anyone view results
3. **Share the link** - Send the public URL to participants and stakeholders

## 📝 CSV Format Guide

Your CSV file should include participant information. Here are the supported columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| Name | ✅ Yes | Participant's full name | "John Doe" |
| Email | ❌ Optional | Email address | "john@email.com" |
| Tickets | ❌ Optional | Number of entries (default: 1) | 3 |
| Prize | ❌ Optional | Specific prize eligibility | "Grand Prize" |

### Sample Data
Need an example? Check out our [sample CSV file](sample_raffle_tickets.csv) to see the expected format.

## 🎪 How It Works

### Fair & Transparent Selection
- **True randomization** using cryptographically secure random number generation
- **No bias** - every eligible participant has equal probability based on their ticket count
- **Transparent process** - watch the selection happen in real-time
- **Verifiable results** - complete audit trail of all selections

### Prize Management
- **Multiple prizes** - run raffles with different prize categories
- **Flexible winners** - set different numbers of winners per prize
- **Smart filtering** - participants can only win once per prize category
- **Automatic handling** - system manages winner exclusions automatically

### Privacy & Security
- **Secure authentication** - enterprise-grade login protection
- **Private by default** - your participant data stays private
- **Optional sharing** - choose when to make results public
- **Data protection** - participant emails never shown in public views

## 🔗 Sharing Results

### Public Raffle Links
Make your raffle results public to share with participants:

1. Go to "My Raffles" in your dashboard
2. Click on any completed raffle
3. Check "Make this raffle public"
4. Copy and share the generated link

Public links show:
- ✅ Winner names and prizes
- ✅ Drawing timestamp
- ✅ Total number of participants
- ❌ No participant emails or personal data

### Export Options
Download your results in CSV format for:
- Record keeping
- Winner notifications
- Regulatory compliance
- Integration with other systems

## 🆘 Support & Help

### Common Questions

**Q: Can the same person win multiple prizes?**
A: By default, no. Each person can only win once per prize category to ensure fairness.

**Q: How random is the selection?**
A: We use JavaScript's built-in random number generator, which provides good randomness for fair raffles. Each eligible participant has an equal chance based on their ticket count.

**Q: Can I edit results after the drawing?**
A: No. Once winners are selected, results are permanent to maintain integrity and trust.

**Q: What happens to my data?**
A: Your raffle data is securely stored and only accessible to you unless you choose to make specific raffles public.

### Need More Help?
- 📧 Email us at [support@rafflewinnerpicker.com](mailto:support@rafflewinnerpicker.com)
- 🐛 Report bugs on [GitHub Issues](https://github.com/automartin5000/raffle-winner-picker/issues)
- 💡 Request features on [GitHub Discussions](https://github.com/automartin5000/raffle-winner-picker/discussions)

## 🎉 Perfect For

- **Charity fundraisers** - transparent drawings build donor trust
- **Company events** - fair employee giveaways and contests  
- **Community organizations** - local raffles and door prizes
- **Online events** - virtual conferences and webinar prizes
- **Schools & nonprofits** - fundraising events and activities
- **Social media contests** - fair selection from engagement

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Interested in contributing? Check out our [Contributing Guide](CONTRIBUTING.md) for developers.

---

*Made with ❤️ for fair and transparent raffles*
