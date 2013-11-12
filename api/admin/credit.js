module.exports = exports = function(app) {
    app.post('/admin/bankCredits', app.security.demand.admin, exports.createBankCredit)
    app.get('/admin/bankCredits', app.security.demand.admin, exports.getBankCredits)
    app.post('/admin/bankCredits/:id/approve', app.security.demand.admin, exports.approveBankCredit)
    app.post('/admin/bankCredits/:id/cancel', app.security.demand.admin, exports.cancelBankCredit)
}

exports.getBankCredits = function(req, res, next) {
    var query = [
        'SELECT',
        '   bc.*,',
        '   u.first_name || \' \' || last_name user_name,',
        '   u.tag user_tag',
        'FROM bank_credit bc',
        'INNER JOIN "user" u ON u.user_id = bc.user_id',
        'WHERE state = \'review\''
    ].join('\n')

    req.app.conn.read.query(query, function(err, dr) {
        if (err) return next(err)

        res.send(dr.rows.map(function(row) {
            return {
                id: row.bank_credit_id,
                userId: row.user_id,
                userName: row.user_name,
                userTag: row.user_tag,
                amount: req.app.cache.formatCurrency(row.amount, row.currency_id),
                currency: row.currency_id,
                createdAt: row.created_at
            }
        }))
    })
}

exports.createBankCredit = function(req, res, next) {
    var query = {
        text: [
            'INSERT INTO bank_credit (user_id, currency_id, amount, reference)',
            'VALUES ($1, $2, $3, $4)',
            'RETURNING bank_credit_id'
        ].join('\n'),
        values: [
            req.body.user_id,
            req.body.currency_id,
            req.app.cache.parseCurrency(req.body.amount, req.body.currency_id),
            req.body.reference
        ]
    }

    req.app.conn.write.query(query, function(err, dr) {
        if (err) return next(err)

        // Log for admin
        req.app.activity(req.user.id, 'AdminAddBankCredit', req.body)

        res.send(201, { id: dr.rows[0].bank_credit_id })
    })
}

exports.approveBankCredit = function(req, res, next) {
    var query = {
        text: [
            'UPDATE bank_credit',
            'SET state = \'approved\'',
            'WHERE bank_credit_id = $1',
            'RETURNING transaction_id'
        ].join('\n'),
        values: [
            +req.params.id
        ]
    }

    req.app.conn.write.query(query, function(err, dr) {
        if (err) return next(err)
        if (!dr.rowCount) {
            return res.send(404, {
                name: 'BankCreditNotFound',
                message: 'The specified bank credit was not found or is not under review'
            })
        }

        // Log for admin
        req.app.activity(req.user.id, 'AdminApproveBankCredit', {
            id: +req.params.id
        })

        res.send(201, { id: dr.rows[0].transaction_id })
    })
}

exports.cancelBankCredit = function(req, res, next) {
    var query = {
        text: [
            'UPDATE bank_credit',
            'SET state = \'canceled\'',
            'WHERE bank_credit_id = $1'
        ].join('\n'),
        values: [
            +req.params.id
        ]
    }

    req.app.conn.write.query(query, function(err, dr) {
        if (err) return next(err)
        if (!dr.rowCount) {
            return res.send(404, {
                name: 'BankCreditNotFound',
                message: 'The specified bank credit was not found or is not under review'
            })
        }

        // Log for admin
        req.app.activity(req.user.id, 'AdminCancelBankCredit', {
            id: +req.params.id
        })

        res.send(204)
    })
}
