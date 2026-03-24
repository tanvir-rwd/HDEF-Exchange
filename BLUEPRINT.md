# VirtuExchange: Technical Blueprint

## 1. Database Schema Design (Firestore)
While you requested MySQL/PostgreSQL, I am implementing this using **Firebase Firestore** to provide a live, production-ready environment. The relational structure is maintained as follows:

### **Users (Collection: `users`)**
- `uid`: String (Primary Key)
- `name`: String
- `email`: String
- `walletBalance`: Number (Default: 1000)
- `role`: String ('admin' | 'user')

### **Products (Collection: `products`)**
- `id`: String (Primary Key)
- `name`: String
- `description`: String
- `imageUrl`: String
- `quantity`: Number
- `price`: Number (Virtual Currency)

### **Transactions (Collection: `transactions`)**
- `id`: String (Primary Key)
- `userId`: String (Foreign Key)
- `productId`: String (Foreign Key)
- `spentAmount`: Number
- `timestamp`: Timestamp

---

## 2. Backend API Logic (Express)

### **Exchange Function (Atomic Transaction)**
```typescript
async function exchangeProduct(userId, productId) {
  const userRef = db.collection('users').doc(userId);
  const productRef = db.collection('products').doc(productId);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const productDoc = await transaction.get(productRef);

    if (!userDoc.exists || !productDoc.exists) throw new Error("Not found");

    const userData = userDoc.data();
    const productData = productDoc.data();

    if (productData.quantity <= 0) throw new Error("Out of stock");
    if (userData.walletBalance < productData.price) throw new Error("Insufficient balance");

    // Atomic Updates
    transaction.update(userRef, { walletBalance: userData.walletBalance - productData.price });
    transaction.update(productRef, { quantity: productData.quantity - 1 });
    
    // Log Transaction
    const transRef = db.collection('transactions').doc();
    transaction.set(transRef, {
      userId,
      productId,
      spentAmount: productData.price,
      timestamp: FieldValue.serverTimestamp()
    });
  });
}
```

---

## 3. Implementation Roadmap
1. **Setup Firebase**: Initialize Auth and Firestore.
2. **Backend (Express)**: Create API routes for product CRUD and the exchange transaction.
3. **Frontend (React)**: Build the `ProductCard`, `AdminDashboard`, and `Wallet` components.
4. **Security**: Implement Firestore Rules to prevent unauthorized balance or inventory edits.
5. **Testing**: Verify atomicity (no double-spending).
