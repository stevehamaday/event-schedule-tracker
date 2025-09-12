# Azure Development Workflow

## 🚀 **Deployment Strategy**

### **Production Environment**
- **URL**: https://showflowapp.azurewebsites.net/
- **Plan**: Basic B1 (Always-on, high performance)
- **Triggers**: Pushes to `feature/experimental-fixes`, `main`, `master`
- **Use**: Live production site for end users

### **Testing Environment** 
- **URL**: https://showflow-clean.azurewebsites.net/
- **Plan**: Free tier (Spins down when idle)
- **Triggers**: Pushes to `testing/azure-features`, `testing/**`
- **Use**: Test new Azure-specific features safely

### **Backup/Fallback**
- **URL**: https://showflow-clean.azurewebsites.net/
- **Triggers**: Same as production (for redundancy)
- **Use**: Emergency backup if production fails

## 🔧 **Development Process**

### **For New Azure Features:**

1. **Create testing branch:**
   ```bash
   git checkout -b testing/azure-features
   # or
   git checkout -b testing/new-feature-name
   ```

2. **Develop and test:**
   - Make changes on testing branch
   - Push to trigger deployment to showflow-clean
   - Test thoroughly on free tier environment

3. **Promote to production:**
   ```bash
   git checkout feature/experimental-fixes
   git merge testing/azure-features
   git push origin feature/experimental-fixes
   ```

### **Branch Strategy:**

- `feature/experimental-fixes` → **Production** (showflowapp.azurewebsites.net)
- `testing/azure-features` → **Testing** (showflow-clean.azurewebsites.net)
- `testing/**` → **Testing** (any testing branch)

## 💡 **Benefits:**

- ✅ **Safe testing** without affecting production users
- ✅ **Zero cost** testing environment (Free tier)
- ✅ **Automatic deployments** for rapid iteration
- ✅ **Production backup** maintained for reliability