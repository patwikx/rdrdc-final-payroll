package com.rdhardware.employeeportal.feature.profile.data

import kotlinx.serialization.Serializable

@Serializable
data class MobileProfileEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: MobileProfileData? = null
)

@Serializable
data class MobileProfileData(
    val id: String,
    val employeeNumber: String,
    val firstName: String,
    val middleName: String? = null,
    val lastName: String,
    val suffix: String? = null,
    val birthDate: String,
    val nationality: String? = null,
    val genderId: String? = null,
    val civilStatusId: String? = null,
    val bloodTypeId: String? = null,
    val position: MobileNamedValue? = null,
    val department: MobileNamedValue? = null,
    val branch: MobileNamedValue? = null,
    val employmentStatus: MobileNamedValue? = null,
    val employmentType: MobileNamedValue? = null,
    val hireDate: String,
    val regularizationDate: String? = null,
    val addresses: List<MobileProfileAddress> = emptyList(),
    val contacts: List<MobileProfileContact> = emptyList(),
    val emails: List<MobileProfileEmail> = emptyList(),
    val emergencyContacts: List<MobileProfileEmergencyContact> = emptyList()
)

@Serializable
data class MobileNamedValue(
    val name: String
)

@Serializable
data class MobileProfileAddress(
    val id: String,
    val street: String? = null,
    val barangay: String? = null,
    val city: String? = null,
    val province: String? = null,
    val postalCode: String? = null,
    val isPrimary: Boolean
)

@Serializable
data class MobileProfileContact(
    val id: String,
    val countryCode: String? = null,
    val number: String,
    val isPrimary: Boolean
)

@Serializable
data class MobileProfileEmail(
    val id: String,
    val email: String,
    val isPrimary: Boolean
)

@Serializable
data class MobileProfileEmergencyContact(
    val id: String,
    val name: String,
    val relationshipId: String,
    val mobileNumber: String? = null,
    val priority: Int
)
