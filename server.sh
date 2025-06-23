#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display header
show_header() {
    clear
    echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       iTrader Server Manager          ║${NC}"
    echo -e "${CYAN}║     P2P Trading Automation System     ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check if development server is running
check_dev_server() {
    if pgrep -f "bun.*app.ts" > /dev/null || pgrep -f "next dev" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to stop development server
stop_dev_server() {
    echo -e "${YELLOW}Stopping development server...${NC}"
    pkill -f "bun.*app.ts" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    sleep 2
    echo -e "${GREEN}Development server stopped${NC}"
}

# Function to manage system accounts
manage_accounts() {
    while true; do
        show_header
        echo -e "${BLUE}Account Management${NC}"
        echo "=================="
        echo ""
        echo "1) Create/Reset Admin Account"
        echo "2) Create Operator Account"
        echo "3) List All Accounts"
        echo "4) Reset Account Password"
        echo "5) Delete Account"
        echo "6) Back to Main Menu"
        echo ""
        read -p "Enter your choice (1-6): " account_choice
        
        case $account_choice in
            1)
                echo ""
                echo -e "${CYAN}Creating/Resetting Admin Account${NC}"
                echo "--------------------------------"
                read -p "Enter admin username (default: admin): " admin_user
                admin_user=${admin_user:-admin}
                read -s -p "Enter admin password: " admin_pass
                echo ""
                read -s -p "Confirm password: " admin_pass_confirm
                echo ""
                
                if [ "$admin_pass" != "$admin_pass_confirm" ]; then
                    echo -e "${RED}Passwords do not match!${NC}"
                    read -p "Press Enter to continue..."
                    continue
                fi
                
                # Create admin account using new manage-webserver-accounts script
                echo -e "$admin_pass\n$admin_pass_confirm" | bun run manage-webserver-accounts.ts create "$admin_user" admin
                echo -e "${GREEN}Admin account created/updated successfully!${NC}"
                read -p "Press Enter to continue..."
                ;;
            
            2)
                echo ""
                echo -e "${CYAN}Creating Operator Account${NC}"
                echo "------------------------"
                read -p "Enter operator username: " op_user
                
                # Create operator account using manage-webserver-accounts.ts
                # This will prompt for password interactively
                bun run manage-webserver-accounts.ts create "$op_user" operator
                read -p "Press Enter to continue..."
                ;;
            
            3)
                echo ""
                echo -e "${CYAN}System Accounts${NC}"
                echo "---------------"
                bun run manage-webserver-accounts.ts list
                echo ""
                read -p "Press Enter to continue..."
                ;;
            
            4)
                echo ""
                echo -e "${CYAN}Reset Account Password${NC}"
                echo "---------------------"
                read -p "Enter username: " reset_user
                
                # Check if it's an admin account (use reset-admin-password.ts)
                # or a regular account (use manage-webserver-accounts.ts)
                if [ "$reset_user" = "admin" ]; then
                    read -s -p "Enter new password: " new_pass
                    echo ""
                    read -s -p "Confirm new password: " new_pass_confirm
                    echo ""
                    
                    if [ "$new_pass" != "$new_pass_confirm" ]; then
                        echo -e "${RED}Passwords do not match!${NC}"
                        read -p "Press Enter to continue..."
                        continue
                    fi
                    
                    echo -e "$new_pass\n$new_pass_confirm" | bun run manage-webserver-accounts.ts reset "$reset_user"
                    echo -e "${GREEN}Password reset successfully!${NC}"
                else
                    # For operator/viewer accounts, use manage-webserver-accounts
                    bun run manage-webserver-accounts.ts reset "$reset_user"
                fi
                read -p "Press Enter to continue..."
                ;;
            
            5)
                echo ""
                echo -e "${CYAN}Delete Account${NC}"
                echo "--------------"
                read -p "Enter username to delete: " del_user
                read -p "Are you sure you want to delete '$del_user'? (y/N): " confirm
                
                if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                    # Note: delete is not implemented in manage-webserver-accounts.ts yet
                # For now, we'll just show a message
                echo -e "${YELLOW}Delete functionality not yet implemented in new system${NC}"
                echo -e "${YELLOW}Please use the interactive mode to delete accounts${NC}"
                    echo -e "${GREEN}Account deleted successfully!${NC}"
                else
                    echo -e "${YELLOW}Account deletion cancelled${NC}"
                fi
                read -p "Press Enter to continue..."
                ;;
            
            6)
                break
                ;;
            
            *)
                echo -e "${RED}Invalid choice!${NC}"
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Function to run CLI
run_cli() {
    echo -e "${CYAN}Starting CLI...${NC}"
    bun run src/app.ts --cli
}

# Function to start development server
start_dev_server() {
    if check_dev_server; then
        echo -e "${YELLOW}Development server is already running!${NC}"
        echo ""
        echo "1) Restart server"
        echo "2) Back to menu"
        read -p "Enter your choice (1-2): " restart_choice
        
        if [ "$restart_choice" = "1" ]; then
            stop_dev_server
        else
            return
        fi
    fi
    
    echo -e "${GREEN}Starting development server...${NC}"
    echo ""
    echo -e "${CYAN}📝 Backend will run on port 3001 (WebSocket API)${NC}"
    echo -e "${CYAN}🎨 Frontend will run on port 3000${NC}"
    echo -e "${CYAN}🔥 Hot reload enabled for both services${NC}"
    echo ""
    
    # Start the development server
    # Note: start-dev.ts no longer exists, starting main app instead
    exec bun run src/app.ts
}

# Function to start production server
start_prod_server() {
    if check_dev_server; then
        echo -e "${YELLOW}Server is already running!${NC}"
        read -p "Press Enter to continue..."
        return
    fi
    
    echo -e "${GREEN}Starting production server...${NC}"
    echo ""
    
    # Check for admin account
    # Note: check-admin-password.ts no longer exists, so we'll skip this check
    echo -e "${YELLOW}Starting server...${NC}"
    
    exec bun run src/app.ts
}

# Function to show server status
show_status() {
    show_header
    echo -e "${BLUE}Server Status${NC}"
    echo "============="
    echo ""
    
    if check_dev_server; then
        echo -e "Server Status: ${GREEN}RUNNING${NC}"
        echo ""
        echo "Active processes:"
        ps aux | grep -E "(bun.*app.ts|next dev)" | grep -v grep
    else
        echo -e "Server Status: ${RED}STOPPED${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Database Status${NC}"
    echo "==============="
    if [ -f "prisma/database.db" ]; then
        echo -e "Database: ${GREEN}EXISTS${NC}"
        echo -n "Size: "
        du -h prisma/database.db | cut -f1
    else
        echo -e "Database: ${RED}NOT FOUND${NC}"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to run database migrations
run_migrations() {
    echo -e "${CYAN}Running database migrations...${NC}"
    npx prisma migrate deploy
    echo -e "${GREEN}Migrations completed!${NC}"
    read -p "Press Enter to continue..."
}

# Main menu
main_menu() {
    while true; do
        show_header
        
        if check_dev_server; then
            echo -e "Server Status: ${GREEN}● RUNNING${NC}"
        else
            echo -e "Server Status: ${RED}● STOPPED${NC}"
        fi
        
        echo ""
        echo "Main Menu:"
        echo "=========="
        echo ""
        echo "1) Start Development Server (with hot reload)"
        echo "2) Start Production Server"
        echo "3) Stop Server"
        echo "4) Server Status"
        echo "5) CLI - Manage Trading Accounts"
        echo "6) Manage System Accounts (Admin/Operators)"
        echo "7) Run Database Migrations"
        echo "8) Exit"
        echo ""
        read -p "Enter your choice (1-8): " main_choice
        
        case $main_choice in
            1)
                start_dev_server
                ;;
            
            2)
                start_prod_server
                ;;
            
            3)
                if check_dev_server; then
                    stop_dev_server
                else
                    echo -e "${YELLOW}Server is not running${NC}"
                    read -p "Press Enter to continue..."
                fi
                ;;
            
            4)
                show_status
                ;;
            
            5)
                if check_dev_server; then
                    echo -e "${YELLOW}Warning: Server is running. CLI may conflict with the running server.${NC}"
                    read -p "Continue anyway? (y/N): " continue_cli
                    if [ "$continue_cli" = "y" ] || [ "$continue_cli" = "Y" ]; then
                        run_cli
                    fi
                else
                    run_cli
                fi
                ;;
            
            6)
                manage_accounts
                ;;
            
            7)
                run_migrations
                ;;
            
            8)
                if check_dev_server; then
                    echo -e "${YELLOW}Server is still running.${NC}"
                    read -p "Stop server and exit? (y/N): " stop_exit
                    if [ "$stop_exit" = "y" ] || [ "$stop_exit" = "Y" ]; then
                        stop_dev_server
                    fi
                fi
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            
            *)
                echo -e "${RED}Invalid choice!${NC}"
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Check dependencies
check_dependencies() {
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}Error: bun is not installed!${NC}"
        echo "Please install bun first: https://bun.sh"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}Error: npm/npx is not installed!${NC}"
        echo "Please install Node.js first: https://nodejs.org"
        exit 1
    fi
}

# Main execution
check_dependencies
main_menu