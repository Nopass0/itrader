# Admin Account Management

## Default Admin Account

When you set up the database using `bun run setup` or `bun run setup:db`, a default admin account will be automatically created with:

- **Username:** admin
- **Password:** admin123

⚠️ **IMPORTANT:** Change the default password immediately after first login!

## Creating Admin Accounts

### Method 1: Using the create-admin script (Interactive)

```bash
bun run create:admin
```

This will prompt you for a username and generate a secure password automatically.

### Method 2: Using the CLI

```bash
bun run accounts
```

Then select option 1 to create a new account and specify the role as "admin".

### Method 3: Using WebSocket API

Connect to the WebSocket server and emit:

```javascript
socket.emit('account:create', {
  username: 'newadmin',
  role: 'admin'
}, (response) => {
  console.log(response);
});
```

## Resetting Admin Password

If you forget the admin password, you can reset it:

```bash
bun run reset:admin
```

This will prompt you to select the admin account and generate a new password.

## Checking Existing Accounts

To see all system accounts:

```bash
bun run db:check
```

Or use:

```bash
bun run accounts
```

And select option 4 to list all accounts.

## Automatic Admin Creation

The application will automatically ensure an admin account exists when:

1. Running `bun run setup:db` - Database setup script
2. Starting the main application with `bun run start` or `bun run app`

If no admin account exists, it will create one with the default credentials mentioned above.

## Security Best Practices

1. **Change default password immediately** after initial setup
2. **Use strong passwords** - The system generates secure passwords automatically
3. **Create individual admin accounts** for each administrator rather than sharing credentials
4. **Regularly review** admin accounts and remove unused ones
5. **Monitor login activity** through the system logs

## Account Roles

- `admin` - Full system access
- `operator` - Can manage transactions and operations
- `viewer` - Read-only access

## Troubleshooting

If you cannot create an admin account:

1. Check database connection: `bun run db:check`
2. Ensure migrations are up to date: `bun run db:migrate`
3. Check logs for errors in `logs/` directory
4. Verify database permissions

For more help, check the system logs or contact support.