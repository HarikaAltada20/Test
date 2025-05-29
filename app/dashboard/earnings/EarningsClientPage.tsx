"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Added for potential future use
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import Link from "next/link"; // Not used directly here if navigation is via router or buttons
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    // DialogTrigger, // Not always needed if controlled by state
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowDownToLine,
    DollarSign,
    Trophy,
    Coins,
    Gift,
    Users,
    PlusCircle,
    Trash2,
    Edit3,
    CreditCard,
    Landmark,
    Wallet as CryptoWalletIcon, // Renamed to avoid conflict
    Sparkles,
    Power,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client"; // Client Supabase
import { CashTransaction, CoinTransaction, CreatorProfileData, PayoutMethod, PayoutMethodType, UserData } from "@/types/earnings"; // Centralized types
import { formatCurrency } from "@/lib/currency-utils";

const formatCoins = (coins: number | bigint = 0): string => {
    return new Intl.NumberFormat().format(Number(coins));
};

const formatDateTime = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
};

interface EarningsClientPageProps {
    initialAuthUser: User | null;
    initialProfile: CreatorProfileData | null;
    initialUserData: UserData | null;
    initialCashTransactions: CashTransaction[];
    initialCoinTransactions: CoinTransaction[];
    initialPayoutMethods: PayoutMethod[];
}

export default function EarningsClientPage({
    initialAuthUser,
    initialProfile,
    initialUserData,
    initialCashTransactions,
    initialCoinTransactions,
    initialPayoutMethods,
}: EarningsClientPageProps) {
    const supabase = createClient();
    const router = useRouter(); // Initialize router

    // States derived from props, allowing client-side updates
    const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
    const [profile, setProfile] = useState<CreatorProfileData | null>(initialProfile);
    const [userData, setUserData] = useState<UserData | null>(initialUserData);
    const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(initialCashTransactions);
    const [coinTransactions, setCoinTransactionsState] = useState<CoinTransaction[]>(initialCoinTransactions);
    const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>(initialPayoutMethods);

    const [isLoading, setIsLoading] = useState(false); // For client-side actions

    // Modal States (same as before)
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [currentPayoutMethod, setCurrentPayoutMethod] = useState<Partial<PayoutMethod> & { details: any } | null>(null);
    const [selectedPayoutType, setSelectedPayoutType] = useState<PayoutMethodType>("crypto");

    const [cryptoType, setCryptoType] = useState<'LTC' | 'USDT_BEP20'>('LTC');
    const [cryptoAddress, setCryptoAddress] = useState('');
    const [paypalEmail, setPaypalEmail] = useState('');
    const [bankAccountHolder, setBankAccountHolder] = useState('');
    const [bankAccountNumber, setBankAccountNumber] = useState('');
    const [bankCountry, setBankCountry] = useState('');
    const [bankSortCode, setBankSortCode] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankRoutingNumber, setBankRoutingNumber] = useState('');
    const [bankIfscCode, setBankIfscCode] = useState('');
    const [upiId, setUpiId] = useState('');

    const [withdrawAmountDollars, setWithdrawAmountDollars] = useState<number>(0); // Amount in dollars for input
    const [selectedWithdrawMethodId, setSelectedWithdrawMethodId] = useState<string | null>(null);
    const [withdrawalUserNotes, setWithdrawalUserNotes] = useState<string>(""); // New state for user notes

    useEffect(() => {
        if (!initialAuthUser) {
            router.push("/login"); // Redirect if no auth user from server
        }
        // Set initial states from props
        setAuthUser(initialAuthUser);
        setProfile(initialProfile);
        setUserData(initialUserData);
        setCashTransactions(initialCashTransactions);
        setCoinTransactionsState(initialCoinTransactions);
        setPayoutMethods(initialPayoutMethods);
    }, [initialAuthUser, initialProfile, initialUserData, initialCashTransactions, initialCoinTransactions, initialPayoutMethods, router]);


    const handleSavePayoutMethod = async () => {
        if (!authUser) return;
        setIsLoading(true);
        let detailsToSave = {};
        switch (selectedPayoutType) {
            case 'crypto':
                detailsToSave = { coin_symbol: cryptoType, address: cryptoAddress };
                if (!cryptoAddress) { alert("Crypto address is required."); setIsLoading(false); return; }
                break;
            case 'paypal':
                detailsToSave = { email: paypalEmail };
                if (!paypalEmail) { alert("PayPal email is required."); setIsLoading(false); return; }
                break;
            case 'bank':
                detailsToSave = {
                    account_holder_name: bankAccountHolder,
                    account_number: bankAccountNumber,
                    country: bankCountry,
                    sort_code: bankSortCode,
                    bank_name: bankName,
                    routing_number: bankRoutingNumber,
                    ifsc_code: bankIfscCode
                };
                if (!bankAccountHolder || !bankAccountNumber || !bankCountry || !bankName) {
                    alert("Account holder name, account number, country, and bank name are required for bank transfers.");
                    setIsLoading(false); return;
                }
                break;
            case 'upi':
                detailsToSave = { upi_id: upiId };
                if (!upiId) { alert("UPI ID is required."); setIsLoading(false); return; }
                break;
        }

        const methodToSave = {
            user_id: authUser.id, // Ensure this uses user_id for user_payout_info
            method_type: selectedPayoutType,
            details: detailsToSave,
            is_default: payoutMethods.length === 0 ? true : (currentPayoutMethod?.is_default || false),
        };

        let resultData: PayoutMethod | null = null;
        let errorOccurred = null;

        if (currentPayoutMethod?.id) { // Editing existing
            const { data, error } = await supabase
                .from("payout_methods") // Updated table name
                .update(methodToSave)
                .eq("id", currentPayoutMethod.id)
                .select(); // Remove .single()
            resultData = data && data.length > 0 ? data[0] : null; // Handle array result
            errorOccurred = error;
        } else { // Adding new
            const { data, error } = await supabase
                .from("payout_methods") // Updated table name
                .insert(methodToSave)
                .select(); // Remove .single()
            resultData = data && data.length > 0 ? data[0] : null; // Handle array result
            errorOccurred = error;
        }
        setIsLoading(false);

        if (errorOccurred) {
            console.error("Error saving payout method:", errorOccurred);
            alert(`Failed to save method: ${errorOccurred.message}`);
        } else if (resultData) {
            if (currentPayoutMethod?.id) {
                setPayoutMethods(payoutMethods.map(p => p.id === resultData!.id ? resultData! : p));
                alert("Payout method updated!");
            } else {
                setPayoutMethods([resultData!, ...payoutMethods]);
                alert("Payout method added!");
            }
            resetPayoutForm();
            setIsPayoutModalOpen(false);
        }
    };

    const resetPayoutForm = () => {
        // (Same as before)
        setCurrentPayoutMethod(null);
        setSelectedPayoutType('crypto');
        setCryptoType('LTC');
        setCryptoAddress('');
        setPaypalEmail('');
        setBankAccountHolder('');
        setBankAccountNumber('');
        setBankCountry('');
        setBankSortCode('');
        setBankName('');
        setBankRoutingNumber('');
        setBankIfscCode('');
        setUpiId('');
    };

    const openEditPayoutModal = (method: PayoutMethod) => {
        // (Same as before, ensure details match selectedPayoutType)
        setCurrentPayoutMethod(method);
        setSelectedPayoutType(method.method_type);
        if (method.method_type === 'crypto') {
            setCryptoType(method.details.coin_symbol || 'LTC');
            setCryptoAddress(method.details.address || '');
        } else if (method.method_type === 'paypal') {
            setPaypalEmail(method.details.email || '');
        } else if (method.method_type === 'bank') {
            setBankAccountHolder(method.details.account_holder_name || '');
            setBankAccountNumber(method.details.account_number || '');
            setBankCountry(method.details.country || '');
            setBankSortCode(method.details.sort_code || '');
            setBankName(method.details.bank_name || '');
            setBankRoutingNumber(method.details.routing_number || '');
            setBankIfscCode(method.details.ifsc_code || '');
        } else if (method.method_type === 'upi') {
            setUpiId(method.details.upi_id || '');
        }
        setIsPayoutModalOpen(true);
    };

    const handleDeletePayoutMethod = async (methodId: string) => {
        if (!confirm("Are you sure you want to delete this payout method?")) return;
        setIsLoading(true);
        const { error } = await supabase.from("payout_methods").delete().eq("id", methodId); // Updated table name
        setIsLoading(false);
        if (error) {
            console.error("Error deleting payout method:", error);
            alert(`Failed to delete method: ${error.message}`);
        } else {
            setPayoutMethods(payoutMethods.filter(p => p.id !== methodId));
            alert("Payout method deleted.");
        }
    };

    const handleSetDefaultPayoutMethod = async (methodId: string) => {
        if (!authUser) return;
        setIsLoading(true);
        // Set all others to false for this user
        const { error: unsetError } = await supabase
            .from("payout_methods") // Updated table name
            .update({ is_default: false })
            .eq("user_id", authUser.id);

        if (unsetError) {
            console.error("Error unsetting other defaults:", unsetError);
            // Decide if you want to proceed or show error and stop
        }

        const { data, error } = await supabase
            .from("payout_methods") // Updated table name
            .update({ is_default: true })
            .eq("id", methodId)
            .eq("user_id", authUser.id) // Ensure user owns this method
            .select()
            .single();
        setIsLoading(false);

        if (error) {
            console.error("Error setting default payout method:", error);
            alert(`Failed to set default method: ${error.message}`);
        } else if (data) {
            setPayoutMethods(payoutMethods.map(p => ({ ...p, is_default: p.id === data.id })));
            alert("Default payout method updated.");
        }
    };

    const handleWithdraw = async () => {
        if (!authUser || !selectedWithdrawMethodId || withdrawAmountDollars <= 0) {
            alert("Please select a payout method and enter a valid amount.");
            return;
        }
        const minWithdrawalDollars = 20;
        const withdrawAmountCents = Math.round(withdrawAmountDollars * 100);

        if (withdrawAmountDollars < minWithdrawalDollars) {
            alert(`Minimum withdrawal amount is ${formatCurrency(minWithdrawalDollars * 100)}.`); // formatCurrency expects cents
            return;
        }
        if (!profile || withdrawAmountCents > (profile.withdrawable_balance_cents || 0)) {
            alert("Insufficient balance.");
            return;
        }
        setIsLoading(true);
        let errorOccurred: any = null; // Declare errorOccurred

        const { data, error } = await supabase // Capture data and error directly
            .from("withdrawal_requests")
            .insert({
                user_id: authUser.id,
                payout_method_id: selectedWithdrawMethodId, // Corrected field name
                amount_cents: withdrawAmountCents,
                currency: 'USD',
                user_notes: withdrawalUserNotes, // Add user notes
                // status will default to 'pending' in the DB
            })
            .select();

        const resultData = data && data.length > 0 ? data[0] : null;
        errorOccurred = error; // Assign error to errorOccurred
        setIsLoading(false);

        if (errorOccurred) {
            console.error("Error creating withdrawal request:", errorOccurred);
            alert(`Withdrawal request failed: ${errorOccurred.message}`);
        } else if (resultData) {
            alert(`Withdrawal request for ${formatCurrency(resultData.amount_cents)} submitted successfully!`);
            setProfile(prev => prev ? ({ ...prev, withdrawable_balance_cents: (prev.withdrawable_balance_cents || 0) - resultData.amount_cents }) : null);
            setIsWithdrawModalOpen(false);
            setWithdrawAmountDollars(0);
            setSelectedWithdrawMethodId(null);
            setWithdrawalUserNotes("");
        }
    };

    const PayoutMethodIcon = ({ type }: { type: PayoutMethodType }) => {
        if (type === 'crypto') return <CryptoWalletIcon className="mr-2 h-5 w-5" />; // Renamed icon import
        if (type === 'paypal') return <Power className="mr-2 h-5 w-5" />;
        if (type === 'bank') return <Landmark className="mr-2 h-5 w-5" />;
        if (type === 'upi') return <Sparkles className="mr-2 h-5 w-5" />;
        return <CreditCard className="mr-2 h-5 w-5" />;
    };

    const getPayoutMethodSummary = (method: PayoutMethod): string => {
        // (Same as before)
        switch (method.method_type) {
            case 'crypto': return `${method.details.coin_symbol || 'Crypto'}: ...${(method.details.address || '').slice(-6)}`;
            case 'paypal': return `PayPal: ${method.details.email || 'N/A'}`;
            case 'bank': return `${method.details.bank_name || 'Bank'}: ...${(method.details.account_number || '').slice(-4)}`;
            case 'upi': return `UPI: ${method.details.upi_id || 'N/A'}`;
            default: return "Unknown Method";
        }
    };

    if (!authUser || !profile || !userData) {
        // This case should ideally be handled by the redirect in the server component for initial load.
        // This check is more for ensuring props are passed correctly.
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="flex items-center justify-center h-64"><p>Loading earnings data or not authenticated...</p></div>
            </div>
        );
    }

    // Derived state for total referrals
    const totalReferrals = (userData.advertisers_referred || 0) + (userData.creators_referred || 0);

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">My Earnings</h1>
            </div>

            <Tabs defaultValue="cash" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="cash">
                        <DollarSign className="h-5 w-5 mr-2" /> Cash Wallet
                    </TabsTrigger>
                    <TabsTrigger value="coins">
                        <Coins className="h-5 w-5 mr-2" /> Coin Wallet
                    </TabsTrigger>
                </TabsList>

                {/* Cash Wallet Tab */}
                <TabsContent value="cash">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Cash Won</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(profile.total_money_won_cents)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime cash earnings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Available for Withdrawal</CardTitle>
                                <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(profile.withdrawable_balance_cents)}</div>
                                <p className="text-xs text-muted-foreground">Minimum withdrawal: {formatCurrency(2000)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cash Contests Won</CardTitle>
                                <Trophy className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{profile.total_contests_won}</div>
                                <p className="text-xs text-muted-foreground">Total cash contest victories</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <Button
                            onClick={() => setIsWithdrawModalOpen(true)}
                            className="flex-1"
                            disabled={(profile.withdrawable_balance_cents || 0) < 2000 || payoutMethods.length === 0 || isLoading}
                        >
                            <ArrowDownToLine className="h-4 w-4 mr-2" /> Withdraw Balance
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { resetPayoutForm(); setIsPayoutModalOpen(true); }}
                            className="flex-1"
                            disabled={isLoading}
                        >
                            <PlusCircle className="h-4 w-4 mr-2" /> Manage Payout Methods
                        </Button>
                    </div>
                    {payoutMethods.length === 0 && (profile.withdrawable_balance_cents || 0) >= 2000 && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-4 text-center">
                            Please add a payout method to withdraw your balance.
                        </p>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Cash Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cashTransactions.length > 0 ? (
                                        cashTransactions.map((transaction) => (
                                            <TableRow key={transaction.id}>
                                                <TableCell>{formatDateTime(transaction.created_at)}</TableCell>
                                                <TableCell>{transaction.description}</TableCell>
                                                <TableCell className="capitalize">{transaction.type?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                                <TableCell>{formatCurrency(transaction.amount_cents)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        transaction.status === "completed" || transaction.status === "credited" ? "default" : // Using 'default' for success (often green)
                                                            transaction.status === "pending" ? "secondary" :
                                                                transaction.status === "failed" ? "destructive" : "outline"
                                                    } className="capitalize">
                                                        {transaction.status?.replace(/_/g, ' ') || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No cash transaction history yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Coin Wallet Tab */}
                <TabsContent value="coins">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Coins Earned</CardTitle>
                                <Coins className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCoins(userData.total_lifetime_coins_earned)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime coin earnings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Coins Available</CardTitle>
                                <CryptoWalletIcon className="h-4 w-4 text-muted-foreground" /> {/* Using renamed icon */}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCoins(userData.coins)}</div>
                                <p className="text-xs text-muted-foreground">Your current coin balance</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalReferrals}</div>
                                <p className="text-xs text-muted-foreground">Successful referrals</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mb-6">
                        <Button className="w-full md:w-auto" disabled={isLoading}>
                            <Gift className="h-4 w-4 mr-2" /> Redeem Coins (Coming Soon)
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Coin Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coinTransactions.length > 0 ? (
                                        coinTransactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell className="capitalize">{tx.type?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                                <TableCell className={tx.coins > 0 ? "text-green-600" : "text-red-600"}>
                                                    {tx.coins > 0 ? "+" : ""}{formatCoins(tx.coins)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        tx.status === "completed" || tx.status === "credited" ? "default" :
                                                            tx.status === "pending" ? "secondary" :
                                                                tx.status === "failed" ? "destructive" : "outline"
                                                    } className="capitalize">
                                                        {tx.status?.replace(/_/g, ' ') || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No coin transaction history yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Payout Methods Modal (Dialog) */}
            <Dialog open={isPayoutModalOpen} onOpenChange={(isOpen) => { if (isLoading && isOpen) return; setIsPayoutModalOpen(isOpen); if (!isOpen) resetPayoutForm(); }}>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>{currentPayoutMethod?.id ? "Edit Payout Method" : "Add New Payout Method"}</DialogTitle>
                        <DialogDescription>
                            Manage your payout methods. Your default method will be pre-selected for withdrawals.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {/* Tabs for payout types (crypto, paypal, bank, upi) */}
                        <Tabs defaultValue={selectedPayoutType} onValueChange={(val) => setSelectedPayoutType(val as PayoutMethodType)} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="crypto">Crypto</TabsTrigger>
                                <TabsTrigger value="paypal">PayPal</TabsTrigger>
                                <TabsTrigger value="bank">Bank</TabsTrigger>
                                <TabsTrigger value="upi">UPI</TabsTrigger>
                            </TabsList>
                            {/* Content for each payout type */}
                            <TabsContent value="crypto" className="pt-4 space-y-3">
                                <Label htmlFor="cryptoType">Cryptocurrency</Label>
                                <Select value={cryptoType} onValueChange={(val) => setCryptoType(val as 'LTC' | 'USDT_BEP20')} disabled={isLoading}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LTC">Litecoin (LTC)</SelectItem>
                                        <SelectItem value="USDT_BEP20">USDT (BEP20)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Label htmlFor="cryptoAddress">Your {cryptoType} Address</Label>
                                <Input id="cryptoAddress" value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} placeholder={`Enter your ${cryptoType} wallet address`} disabled={isLoading} />
                            </TabsContent>
                            <TabsContent value="paypal" className="pt-4 space-y-3">
                                <Label htmlFor="paypalEmail">PayPal Email</Label>
                                <Input id="paypalEmail" type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="Enter your PayPal email address" disabled={isLoading} />
                            </TabsContent>
                            <TabsContent value="bank" className="pt-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div><Label htmlFor="bankAccountHolder">Account Holder Name</Label><Input id="bankAccountHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankAccountNumber">Account Number</Label><Input id="bankAccountNumber" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankCountry">Country</Label><Input id="bankCountry" value={bankCountry} onChange={(e) => setBankCountry(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankName">Bank Name</Label><Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankSortCode">Sort Code (UK)</Label><Input id="bankSortCode" value={bankSortCode} onChange={(e) => setBankSortCode(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankRoutingNumber">Routing Number (US)</Label><Input id="bankRoutingNumber" value={bankRoutingNumber} onChange={(e) => setBankRoutingNumber(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankIfscCode">IFSC Code (India)</Label><Input id="bankIfscCode" value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value)} disabled={isLoading} /></div>
                                </div>
                            </TabsContent>
                            <TabsContent value="upi" className="pt-4 space-y-3">
                                <Label htmlFor="upiId">UPI ID (India)</Label>
                                <Input id="upiId" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="Enter your UPI ID (e.g., yourname@bank)" disabled={isLoading} />
                            </TabsContent>
                        </Tabs>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button onClick={handleSavePayoutMethod} disabled={isLoading}>
                            {isLoading ? "Saving..." : (currentPayoutMethod?.id ? "Save Changes" : "Add Method")}
                        </Button>
                    </DialogFooter>

                    {payoutMethods.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                            <h3 className="text-lg font-medium mb-3">Your Saved Methods</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {payoutMethods.map(method => (
                                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-800">
                                        <div className="flex items-center">
                                            <PayoutMethodIcon type={method.method_type} />
                                            <div>
                                                <p className="font-medium text-sm">{getPayoutMethodSummary(method)}</p>
                                                {method.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {!method.is_default && <Button variant="ghost" size="sm" onClick={() => handleSetDefaultPayoutMethod(method.id)} disabled={isLoading}>Set Default</Button>}
                                            <Button variant="ghost" size="icon" onClick={() => openEditPayoutModal(method)} disabled={isLoading}><Edit3 className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeletePayoutMethod(method.id)} disabled={isLoading}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Withdraw Balance Modal */}
            <Dialog open={isWithdrawModalOpen} onOpenChange={(isOpen) => { if (isLoading && isOpen) return; setIsWithdrawModalOpen(isOpen); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Withdraw Balance</DialogTitle>
                        <DialogDescription>
                            Withdraw funds to your preferred payout method. Minimum withdrawal is {formatCurrency(2000)}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="text-lg">Available: <span className="font-semibold">{formatCurrency(profile.withdrawable_balance_cents)}</span></div>
                        <div>
                            <Label htmlFor="withdrawAmountDollars">Amount to Withdraw (USD)</Label>
                            <Input
                                id="withdrawAmountDollars"
                                type="number"
                                value={withdrawAmountDollars <= 0 ? '' : withdrawAmountDollars}
                                onChange={(e) => setWithdrawAmountDollars(parseFloat(e.target.value) || 0)}
                                min="20" // Minimum in dollars
                                step="0.01"
                                placeholder="e.g., 50.00"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label htmlFor="withdrawalUserNotes">Notes (Optional)</Label>
                            <Input
                                id="withdrawalUserNotes"
                                value={withdrawalUserNotes}
                                onChange={(e) => setWithdrawalUserNotes(e.target.value)}
                                placeholder="Optional notes for your withdrawal request"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label htmlFor="payoutMethodSelect">Select Payout Method</Label>
                            <Select
                                value={selectedWithdrawMethodId || ""}
                                onValueChange={setSelectedWithdrawMethodId}
                                disabled={isLoading || payoutMethods.length === 0}
                            >
                                <SelectTrigger id="payoutMethodSelect">
                                    <SelectValue placeholder="Choose a method..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {payoutMethods.filter(m => m.is_default).map(method => (
                                        <SelectItem key={method.id} value={method.id}>{getPayoutMethodSummary(method)} (Default)</SelectItem>
                                    ))}
                                    {payoutMethods.filter(m => !m.is_default).map(method => (
                                        <SelectItem key={method.id} value={method.id}>{getPayoutMethodSummary(method)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {payoutMethods.length === 0 && <p className="text-sm text-red-500">You have no payout methods. Please add one first.</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button
                            onClick={handleWithdraw}
                            disabled={
                                isLoading ||
                                !selectedWithdrawMethodId ||
                                withdrawAmountDollars < 20 ||
                                (Math.round(withdrawAmountDollars * 100)) > (profile.withdrawable_balance_cents || 0) ||
                                payoutMethods.length === 0
                            }
                        >
                            {isLoading ? "Processing..." : "Request Withdrawal"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 